// src/hooks/useScheduleReader.ts
/**
 * Hook for reading scheduled job stages (read-only)
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FACTORY_TZ = "UTC";         // display everything in UTC to match DB 08:00+00
const FIRST_SHIFT = "08:00";      // first visible slot for carry-over chips

export interface ScheduledStageData {
  id: string;
  job_id: string;
  job_wo_no: string;
  production_stage_id: string;
  stage_name: string;
  stage_order: number;
  estimated_duration_minutes: number; // used for the badge + totals (we stuff scheduled minutes here)
  scheduled_start_at: string;
  scheduled_end_at: string;
  status: string;
  stage_color?: string;
  is_carry_over?: boolean;        // tag for UI styling if you want
}

export interface TimeSlotData {
  time_slot: string;
  scheduled_stages: ScheduledStageData[];
}

export interface ScheduleDayData {
  date: string;
  day_name: string;
  time_slots: TimeSlotData[];
  total_stages: number;
  total_minutes: number;
}

function isoDateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}
function timeSlotUTC(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${hh}:00`;
}
function addMinutesISO(startIso: string, minutes: number) {
  const d = new Date(startIso);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString();
}

export function useScheduleReader() {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1) stage instances (we display scheduled_* from here)
      const { data: stageInstances, error: stagesError } = await supabase
        .from("job_stage_instances")
        .select(`
          id,
          job_id,
          production_stage_id,
          stage_order,
          scheduled_start_at,
          scheduled_end_at,
          status
        `)
        .not("scheduled_start_at", "is", null)
        .not("scheduled_end_at", "is", null)
        .order("scheduled_start_at", { ascending: true });

      if (stagesError) {
        console.error("Error fetching scheduled stages:", stagesError);
        toast.error("Failed to fetch scheduled stages");
        return;
      }
      if (!stageInstances || stageInstances.length === 0) {
        setScheduleDays([]);
        toast.success("No scheduled stages found");
        return;
      }

      // 2) lookups
      const stageIds = [...new Set(stageInstances.map((s) => s.production_stage_id))];
      const jobIds = [...new Set(stageInstances.map((s) => s.job_id))];

      const { data: productionStages } = await supabase
        .from("production_stages")
        .select("id, name, color")
        .in("id", stageIds);

      const { data: productionJobs } = await supabase
        .from("production_jobs")
        .select("id, wo_no")
        .in("id", jobIds);

      const stageMap = new Map((productionStages || []).map((s) => [s.id, s]));
      const jobMap = new Map((productionJobs || []).map((j) => [j.id, j]));

      // 3) bucket by day+hour (UTC to avoid +02 shift)
      const scheduleMap = new Map<string, Map<string, ScheduledStageData[]>>();
      const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"]; // displayed columns

      const pushToBucket = (date: string, slot: string, rec: ScheduledStageData) => {
        if (!scheduleMap.has(date)) scheduleMap.set(date, new Map());
        const dayMap = scheduleMap.get(date)!;
        if (!dayMap.has(slot)) dayMap.set(slot, []);
        dayMap.get(slot)!.push(rec);
      };

      for (const si of stageInstances) {
        const start = new Date(si.scheduled_start_at);
        const end   = new Date(si.scheduled_end_at);

        const startDate = isoDateUTC(start);
        const startSlot = timeSlotUTC(start);
        const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

        const stage = stageMap.get(si.production_stage_id);
        const job = jobMap.get(si.job_id);

        const baseRec: ScheduledStageData = {
          id: si.id,
          job_id: si.job_id,
          job_wo_no: job?.wo_no || "Unknown",
          production_stage_id: si.production_stage_id,
          stage_name: stage?.name || "Unknown Stage",
          stage_order: si.stage_order ?? 9999,
          // use actual scheduled minutes for badge/totals
          estimated_duration_minutes: minutes,
          scheduled_start_at: si.scheduled_start_at,
          scheduled_end_at: si.scheduled_end_at,
          status: si.status,
          stage_color: stage?.color || "#6B7280",
        };

        pushToBucket(startDate, startSlot, baseRec);

        // carry-over: if it crosses midnight, add a marker at next day 08:00
        const endDate = isoDateUTC(end);
        if (endDate !== startDate) {
          const minutesToMidnight =
            (24 * 60) - (start.getUTCHours() * 60 + start.getUTCMinutes());
          const remaining = Math.max(1, minutes - minutesToMidnight);

          const next = new Date(Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth(),
            start.getUTCDate() + 1, 0, 0, 0
          ));
          const nextDate = isoDateUTC(next);
          const carryStartIso = `${nextDate}T${FIRST_SHIFT}:00.000Z`;
          const carryEndIso   = addMinutesISO(carryStartIso, remaining);

          pushToBucket(nextDate, FIRST_SHIFT, {
            ...baseRec,
            id: `${si.id}-carry`,
            stage_name: `${baseRec.stage_name} (cont.)`,
            is_carry_over: true,
            scheduled_start_at: carryStartIso,
            scheduled_end_at: carryEndIso,
            estimated_duration_minutes: remaining,
          });
        }
      }

      // 4) to array for UI
      const out: ScheduleDayData[] = [];
      scheduleMap.forEach((dayMap, date) => {
        const dateObj = new Date(`${date}T00:00:00.000Z`);
        const timeSlotData: TimeSlotData[] = timeSlots.map((slot) => ({
          time_slot: slot,
          scheduled_stages: dayMap.get(slot) || [],
        }));

        const flat = Array.from(dayMap.values()).flat();
        const totalStages = flat.length;
        const totalMinutes = flat.reduce((sum, s) => sum + (s.estimated_duration_minutes || 0), 0);

        out.push({
          date,
          day_name: dateObj.toLocaleDateString("en-GB", { weekday: "long", timeZone: FACTORY_TZ }),
          time_slots: timeSlotData,
          total_stages: totalStages,
          total_minutes: totalMinutes,
        });
      });

      out.sort((a, b) => a.date.localeCompare(b.date));
      setScheduleDays(out);

      toast.success(`Loaded schedule with ${stageInstances.length} stages across ${out.length} days`);
    } catch (error) {
      console.error("Error in fetchSchedule:", error);
      toast.error("Failed to fetch schedule data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerReschedule = useCallback(async () => {
    try {
      console.log("🔄 Triggering reschedule via scheduler-run edge function...");
      // for a from-scratch rebuild, you can pass nuclear + wipeAll here
      const { data, error } = await supabase.functions.invoke("scheduler-run", {
        body: { commit: true, proposed: false, onlyIfUnset: true, nuclear: true, wipeAll: true },
      });
      if (error) {
        console.error("Error triggering reschedule:", error);
        toast.error("Failed to trigger reschedule");
        return false;
      }
      console.log("✅ Reschedule triggered:", data);
      toast.success(`Successfully rescheduled ${data?.scheduled || 0} stages`);
      setTimeout(() => { fetchSchedule(); }, 1500);
      return true;
    } catch (error) {
      console.error("Error triggering reschedule:", error);
      toast.error("Failed to trigger reschedule");
      return false;
    }
  }, [fetchSchedule]);

  return { scheduleDays, isLoading, fetchSchedule, triggerReschedule };
}
