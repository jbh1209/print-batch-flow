// src/hooks/useScheduleReader.ts
/**
 * Hook for reading scheduled job stages (read-only)
 * - Buckets by ISO HH (no browser TZ drift)
 * - Exposes start_hhmm / end_hhmm already formatted from ISO
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScheduledStageData {
  id: string;
  job_id: string;
  job_wo_no: string;
  production_stage_id: string;
  stage_name: string;
  stage_order: number;
  estimated_duration_minutes: number;
  scheduled_start_at: string;
  scheduled_end_at: string;
  start_hhmm: string; // NEW: "HH:MM" derived from ISO string
  end_hhmm: string;   // NEW: "HH:MM" derived from ISO string
  status: string;
  stage_color?: string;
}

export interface TimeSlotData {
  time_slot: string; // "08:00", "09:00", ...
  scheduled_stages: ScheduledStageData[];
}

export interface ScheduleDayData {
  date: string; // "YYYY-MM-DD"
  day_name: string;
  time_slots: TimeSlotData[];
  total_stages: number;
  total_minutes: number;
}

const HH = (iso?: string) => (iso ? iso.slice(11, 13) : "");
const HHMM = (iso?: string) => (iso ? iso.slice(11, 16) : "");

export function useScheduleReader() {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1) base rows
      const { data: stageInstances, error: stagesError } = await supabase
        .from("job_stage_instances")
        .select(
          `
            id,
            job_id,
            production_stage_id,
            stage_order,
            estimated_duration_minutes,
            scheduled_start_at,
            scheduled_end_at,
            status
          `
        )
        .not("scheduled_start_at", "is", null)
        .not("scheduled_end_at", "is", null)
        .order("scheduled_start_at", { ascending: true });

      if (stagesError) {
        console.error("Error fetching scheduled stages:", stagesError);
        toast.error("Failed to fetch scheduled stages");
        setScheduleDays([]);
        return;
      }

      if (!stageInstances?.length) {
        setScheduleDays([]);
        toast.success("No scheduled stages found");
        return;
      }

      // 2) lookups
      const stageIds = [...new Set(stageInstances.map((s) => s.production_stage_id))];
      const jobIds = [...new Set(stageInstances.map((s) => s.job_id))];

      const [{ data: productionStages }, { data: productionJobs }] =
        await Promise.all([
          supabase
            .from("production_stages")
            .select("id, name, color")
            .in("id", stageIds),
          supabase
            .from("production_jobs")
            .select("id, wo_no")
            .in("id", jobIds),
        ]);

      const stageMap = new Map(
        (productionStages ?? []).map((s) => [s.id, s])
      );
      const jobMap = new Map((productionJobs ?? []).map((j) => [j.id, j]));

      // 3) bucket by date + HH using ISO slices (tz-safe)
      const scheduleMap = new Map<string, Map<string, ScheduledStageData[]>>();
      const timeSlots = [
        "08:00",
        "09:00",
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
      ];

      for (const si of stageInstances) {
        const startISO: string = si.scheduled_start_at as string;
        const endISO: string = si.scheduled_end_at as string;
        const date = startISO.slice(0, 10); // YYYY-MM-DD
        const hour = HH(startISO);
        const timeSlot = `${hour}:00`;

        if (!scheduleMap.has(date)) scheduleMap.set(date, new Map());
        const dayMap = scheduleMap.get(date)!;
        if (!dayMap.has(timeSlot)) dayMap.set(timeSlot, []);

        const stage = stageMap.get(si.production_stage_id);
        const job = jobMap.get(si.job_id);

        dayMap.get(timeSlot)!.push({
          id: si.id,
          job_id: si.job_id,
          job_wo_no: job?.wo_no ?? "Unknown",
          production_stage_id: si.production_stage_id,
          stage_name: stage?.name ?? "Unknown Stage",
          stage_order: si.stage_order ?? 9999,
          estimated_duration_minutes: si.estimated_duration_minutes ?? 0,
          scheduled_start_at: startISO,
          scheduled_end_at: endISO,
          start_hhmm: HHMM(startISO), // <- use these on the card
          end_hhmm: HHMM(endISO),
          status: si.status,
          stage_color: stage?.color ?? "#6B7280",
        });
      }

      // 4) flatten to UI structure
      const days: ScheduleDayData[] = [];
      scheduleMap.forEach((dayMap, date) => {
        const dateObj = new Date(date);
        const timeSlotData: TimeSlotData[] = timeSlots.map((slot) => ({
          time_slot: slot,
          scheduled_stages: dayMap.get(slot) ?? [],
        }));

        const all = Array.from(dayMap.values()).flat();
        const totalStages = all.length;
        const totalMinutes = all.reduce(
          (sum, st) => sum + (st.estimated_duration_minutes ?? 0),
          0
        );

        days.push({
          date,
          day_name: dateObj.toLocaleDateString("en-GB", { weekday: "long" }),
          time_slots: timeSlotData,
          total_stages: totalStages,
          total_minutes: totalMinutes,
        });
      });

      days.sort((a, b) => a.date.localeCompare(b.date));
      setScheduleDays(days);

      toast.success(
        `Loaded schedule with ${stageInstances.length} stages across ${days.length} days`
      );
    } catch (err) {
      console.error("Error in fetchSchedule:", err);
      toast.error("Failed to fetch schedule data");
      setScheduleDays([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerReschedule = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("scheduler-run", {
        body: { commit: true, proposed: false, onlyIfUnset: true },
      });
      if (error) {
        console.error("Error triggering reschedule:", error);
        toast.error("Failed to trigger reschedule");
        return false;
      }
      toast.success(`Successfully rescheduled ${data?.scheduled || 0} stages`);
      setTimeout(() => fetchSchedule(), 1200);
      return true;
    } catch (err) {
      console.error("Error triggering reschedule:", err);
      toast.error("Failed to trigger reschedule");
      return false;
    }
  }, [fetchSchedule]);

  return { scheduleDays, isLoading, fetchSchedule, triggerReschedule };
}
