// src/hooks/useScheduleReader.ts
/** Hook for reading scheduled job stages (read-only) */
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
  // minutes shown on the badge — derived from scheduled start/end
  minutes: number;
  scheduled_start_at: string;
  scheduled_end_at: string;
  status: string;
  stage_color?: string;
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

/** ----- Time-zone helpers (show factory time, not browser local) ----- */
const FACTORY_TZ = "Africa/Johannesburg"; // <-- change if needed

// get an object with year-month-day + hour in factory TZ
function toFactoryParts(iso: string) {
  const dt = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: FACTORY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  // @ts-ignore
  const parts = Object.fromEntries(fmt.formatToParts(dt).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  return { date, hour };
}

export function useScheduleReader() {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1) Fetch scheduled stage instances
      const { data: stageInstances, error: stagesError } = await supabase
        .from("job_stage_instances")
        .select(`
          id,
          job_id,
          production_stage_id,
          stage_order,
          scheduled_start_at,
          scheduled_end_at,
          status,
          job_table_name
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

      // 2) Lookups
      const stageIds = [...new Set(stageInstances.map((s: any) => s.production_stage_id))];
      const jobIds = [...new Set(stageInstances.map((s: any) => s.job_id))];

      const [{ data: productionStages }, { data: productionJobs }] = await Promise.all([
        supabase.from("production_stages").select("id, name, color").in("id", stageIds),
        supabase.from("production_jobs").select("id, wo_no").in("id", jobIds),
      ]);

      const stageMap = new Map((productionStages || []).map((s: any) => [s.id, s]));
      const jobMap = new Map((productionJobs || []).map((j: any) => [j.id, j]));

      // 3) Bucket into day -> hourly slots in factory TZ
      const scheduleMap = new Map<string, Map<string, ScheduledStageData[]>>();
      const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"];

      for (const si of stageInstances as any[]) {
        // minutes from scheduled range
        const ms =
          new Date(si.scheduled_end_at).getTime() -
          new Date(si.scheduled_start_at).getTime();
        const minutes = Math.max(1, Math.round(ms / 60_000));

        // bucket by factory date/hour
        const { date, hour } = toFactoryParts(si.scheduled_start_at);
        const timeSlot = `${hour.toString().padStart(2, "0")}:00`;

        const stage = stageMap.get(si.production_stage_id);
        const job = jobMap.get(si.job_id);

        if (!scheduleMap.has(date)) scheduleMap.set(date, new Map());
        const dayMap = scheduleMap.get(date)!;
        if (!dayMap.has(timeSlot)) dayMap.set(timeSlot, []);

        dayMap.get(timeSlot)!.push({
          id: si.id,
          job_id: si.job_id,
          job_wo_no: job?.wo_no || "Unknown",
          production_stage_id: si.production_stage_id,
          stage_name: stage?.name || "Unknown Stage",
          stage_order: si.stage_order,
          minutes,
          scheduled_start_at: si.scheduled_start_at,
          scheduled_end_at: si.scheduled_end_at,
          status: si.status,
          stage_color: stage?.color || "#6B7280",
        });
      }

      // 4) Build day array
      const out: ScheduleDayData[] = [];
      scheduleMap.forEach((dayMap, date) => {
        const dayName = new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          timeZone: FACTORY_TZ,
        }).format(new Date(date + "T00:00:00Z"));

        const timeSlotData: TimeSlotData[] = timeSlots.map((slot) => ({
          time_slot: slot,
          scheduled_stages: dayMap.get(slot) || [],
        }));

        const allStages = Array.from(dayMap.values()).flat();
        const totalStages = allStages.length;
        const totalMinutes = allStages.reduce((sum, s) => sum + (s.minutes || 0), 0);

        out.push({
          date,
          day_name: dayName,
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
      toast.message?.("Rebuilding schedule…");
      const { data, error } = await supabase.functions.invoke("scheduler-run", {
        body: {
          commit: true,
          proposed: false,
          onlyIfUnset: false,
          nuclear: true,
          wipeAll: true,
          startFrom: new Date().toISOString().slice(0, 10),
        },
      });
      if (error) {
        console.error("Error triggering reschedule:", error);
        toast.error("Failed to trigger reschedule");
        return false;
      }
      console.log("scheduler-run response:", data);
      toast.success(`Rescheduled ${data?.scheduled ?? 0} stages`);
      await fetchSchedule();
      return true;
    } catch (error) {
      console.error("Error triggering reschedule:", error);
      toast.error("Failed to trigger reschedule");
      return false;
    }
  }, [fetchSchedule]);

  return { scheduleDays, isLoading, fetchSchedule, triggerReschedule };
}
