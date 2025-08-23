// src/hooks/useScheduleReader.ts
/**
 * Hook for reading scheduled job stages (read-only) from stage_time_slots.
 * - Uses slot.duration_minutes (real minutes)
 * - Renders times in the factory time zone (not the browser's)
 * - Emits a "carry-over" record at the next day's first shift when a slot spans days
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** 👇 Set your factory time zone here (or via Vite env VITE_FACTORY_TZ) */
const FACTORY_TZ =
  (import.meta as any)?.env?.VITE_FACTORY_TZ || "Africa/Johannesburg";

/** 👇 First shift start (local factory time). If you later store shifts, you can fetch them. */
const FIRST_SHIFT_START = "08:00";

/** Build a formatter to extract parts in a fixed time zone */
function fmtParts(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: FACTORY_TZ, ...opts })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
}

/** Format to YYYY-MM-DD in factory TZ */
function toTZDateString(d: Date) {
  const p = fmtParts(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** Format to HH:MM (24h) in factory TZ */
function toTZTimeHHMM(d: Date) {
  const p = fmtParts(d, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${p.hour}:${p.minute}`;
}

/** Build a Date in factory TZ from YYYY-MM-DD + HH:MM */
function fromTZ(date: string, hhmm: string) {
  // Construct an ISO string in that TZ by temporarily formatting using the TZ offset.
  // Simpler approach: interpret as “local to FACTORY_TZ” then convert via Date.parse of UTC string.
  // We can safely create a Date from the individual parts & then shift using the TZ formatted string.
  const [H, M] = hhmm.split(":").map((x) => +x);
  // Start with the date at 00:00 in the factory timezone:
  const seed = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 0, 0, 0));
  // Add H:M in the factory timezone by asking what clock reads there:
  const p0 = fmtParts(seed, { hour: "2-digit", minute: "2-digit", hour12: false });
  // Find delta minutes between desired (H:M) and (p0.hour:p0.minute) in TZ
  const want = H * 60 + M;
  const have = (+p0.hour) * 60 + (+p0.minute);
  const deltaMin = want - have;
  return new Date(seed.getTime() + deltaMin * 60_000);
}

/** Types for the board UI */
export interface ScheduledStageData {
  id: string; // stage_instance_id (or a synthetic id for carry-over)
  job_id: string;
  job_wo_no: string;
  production_stage_id: string;
  stage_name: string;
  stage_order: number | null;
  minutes: number; // <- real minutes for the chip
  scheduled_start_at: string; // ISO
  scheduled_end_at: string;   // ISO
  status: string;             // "pending" etc (we keep "pending" for UI)
  stage_color?: string;
  is_carry_over?: boolean;    // marks the 08:00 record on the next day
}

export interface TimeSlotData {
  time_slot: string; // "08:00", "09:00" ...
  scheduled_stages: ScheduledStageData[];
}

export interface ScheduleDayData {
  date: string;      // YYYY-MM-DD (factory TZ)
  day_name: string;  // "Monday" ...
  time_slots: TimeSlotData[];
  total_stages: number;
  total_minutes: number;
}

export function useScheduleReader() {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1) Pull the mirrored board rows
      const { data: slots, error: slotErr } = await supabase
        .from("stage_time_slots")
        .select(
          `
          stage_instance_id,
          job_id,
          production_stage_id,
          slot_start_time,
          slot_end_time,
          duration_minutes,
          job_table,
          stage_order
        `
        )
        .order("slot_start_time", { ascending: true });

      if (slotErr) {
        console.error("Error fetching stage_time_slots:", slotErr);
        toast.error("Failed to fetch schedule");
        return;
      }

      if (!slots || slots.length === 0) {
        setScheduleDays([]);
        toast.success("No scheduled stages found");
        return;
      }

      // 2) Batch lookups for names/colors/WO
      const stageIds = [...new Set(slots.map((s) => s.production_stage_id))];
      const jobIds = [...new Set(slots.map((s) => s.job_id))];

      const [{ data: stages }, { data: jobs }] = await Promise.all([
        supabase.from("production_stages").select("id, name, color").in("id", stageIds),
        supabase.from("production_jobs").select("id, wo_no").in("id", jobIds),
      ]);

      const stageMap = new Map((stages || []).map((s) => [s.id, s]));
      const jobMap = new Map((jobs || []).map((j) => [j.id, j]));

      // 3) Build a schedule map: date -> hour -> stages
      const scheduleMap = new Map<string, Map<string, ScheduledStageData[]>>();

      // Build a reasonable hour grid (08:00..17:00). If you want more, extend here.
      const HOURS = Array.from({ length: 10 }).map((_, i) =>
        String(8 + i).padStart(2, "0") + ":00"
      );

      function pushToDay(date: string, hhmm: string, rec: ScheduledStageData) {
        if (!scheduleMap.has(date)) scheduleMap.set(date, new Map());
        const dayMap = scheduleMap.get(date)!;
        if (!dayMap.has(hhmm)) dayMap.set(hhmm, []);
        dayMap.get(hhmm)!.push(rec);
      }

      // Helper to compute carry-over chunk minutes on the ending day (from first shift to end)
      function carryMinutesForEndDay(endISO: string) {
        const end = new Date(endISO);
        const endDate = toTZDateString(end);
        const shiftStart = fromTZ(endDate, FIRST_SHIFT_START);
        const mins = Math.max(0, Math.round((end.getTime() - shiftStart.getTime()) / 60_000));
        return mins;
      }

      for (const s of slots) {
        const start = new Date(s.slot_start_time);
        const end = new Date(s.slot_end_time);

        const dateStart = toTZDateString(start);
        const dateEnd = toTZDateString(end);
        const hourStart = toTZTimeHHMM(start); // in factory TZ

        const stageMeta = stageMap.get(s.production_stage_id);
        const jobMeta = jobMap.get(s.job_id);

        // Main record (as planned)
        const rec: ScheduledStageData = {
          id: s.stage_instance_id,
          job_id: s.job_id,
          job_wo_no: jobMeta?.wo_no || "Unknown",
          production_stage_id: s.production_stage_id,
          stage_name: stageMeta?.name || "Unknown Stage",
          stage_order: s.stage_order ?? null,
          minutes: Number(s.duration_minutes) || 0,
          scheduled_start_at: new Date(start).toISOString(),
          scheduled_end_at: new Date(end).toISOString(),
          status: "pending",
          stage_color: stageMeta?.color || "#6B7280",
        };

        pushToDay(dateStart, hourStart, rec);

        // If the slot spills into the next day, add a carry-over record at that day’s first shift.
        if (dateEnd !== dateStart) {
          const carryMins = carryMinutesForEndDay(end.toISOString());
          if (carryMins > 0) {
            const carryStart = fromTZ(dateEnd, FIRST_SHIFT_START);
            const carry: ScheduledStageData = {
              ...rec,
              id: `${rec.id}__carry_${dateEnd}`, // synthetic id so React lists are stable
              minutes: carryMins,
              scheduled_start_at: carryStart.toISOString(),
              scheduled_end_at: end.toISOString(),
              is_carry_over: true,
            };
            pushToDay(dateEnd, FIRST_SHIFT_START, carry);
          }
        }
      }

      // 4) Materialize to array for the UI
      const days: ScheduleDayData[] = [];
      scheduleMap.forEach((dayMap, date) => {
        // Build hourly slots for the panel in a fixed order
        const timeSlots: TimeSlotData[] = HOURS.map((h) => ({
          time_slot: h,
          scheduled_stages: dayMap.get(h) || [],
        }));

        const totalStages = Array.from(dayMap.values()).reduce(
          (n, arr) => n + arr.length,
          0
        );
        const totalMinutes = Array.from(dayMap.values()).flat().reduce((n, r) => n + (r.minutes || 0), 0);

        const d = new Date(date + "T00:00:00Z");
        const dayName = new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          timeZone: FACTORY_TZ,
        }).format(d);

        days.push({
          date,
          day_name: dayName,
          time_slots: timeSlots,
          total_stages: totalStages,
          total_minutes: totalMinutes,
        });
      });

      days.sort((a, b) => a.date.localeCompare(b.date));

      setScheduleDays(days);
      toast.success(`Loaded ${days.reduce((n, d) => n + d.total_stages, 0)} slots across ${days.length} day(s)`);
    } catch (err) {
      console.error("Error in fetchSchedule:", err);
      toast.error("Failed to fetch schedule data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerReschedule = useCallback(async () => {
    try {
      // UX ping
      try { toast.message?.("Rebuilding schedule…"); } catch {}

      const startFrom = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
      const { data, error } = await supabase.functions.invoke("scheduler-run", {
        body: {
          commit: true,
          proposed: false,
          onlyIfUnset: false,
          nuclear: true,
          startFrom,
          wipeAll: true,
        },
      });

      if (error) {
        console.error("Error triggering reschedule:", error);
        toast.error("Reschedule failed");
        return false;
      }
      console.log("scheduler-run response:", data);

      await fetchSchedule();
      try { toast.success?.(`Rescheduled ${data?.scheduled ?? 0} stages`); } catch {}
      return true;
    } catch (err) {
      console.error("Error triggering reschedule:", err);
      toast.error("Reschedule failed");
      return false;
    }
  }, [fetchSchedule]);

  return { scheduleDays, isLoading, fetchSchedule, triggerReschedule };
}
