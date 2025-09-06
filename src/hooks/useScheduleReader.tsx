/** Hook for reading scheduled job stages (read-only) */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parsePaperSpecsFromNotes, formatPaperDisplay } from "@/utils/paperSpecUtils";

/* ------------------------- types ------------------------- */

export interface ScheduledStageData {
  id: string;
  job_id: string;
  job_wo_no: string;
  production_stage_id: string;
  stage_name: string;
  stage_order: number;
  estimated_duration_minutes: number; // used as "minutes" to render the chip
  start_hhmm: string;         // formatted for display (factory-local)
  end_hhmm: string;           // formatted for display (factory-local)
  status: string;
  stage_color?: string;
  paper_type?: string;
  paper_weight?: string;
  paper_display?: string;     // combined display format like "230gsm FBB"
  // helper flag to style carry-overs if you want (optional)
  // is_carry?: boolean;
}

export interface TimeSlotData {
  time_slot: string; // "08:00", "09:00", ...
  scheduled_stages: ScheduledStageData[];
}

export interface ScheduleDayData {
  date: string;      // "YYYY-MM-DD" (factory-local date)
  day_name: string;  // "Monday", etc.
  time_slots: TimeSlotData[];
  total_stages: number;
  total_minutes: number;
}

/* ---------------------- tz + helpers --------------------- */

const FACTORY_TZ =
  import.meta.env.NEXT_PUBLIC_FACTORY_TZ ||
  "UTC";

// First shift for carry-overs (08:00)
const FIRST_SHIFT_HH = 8;
const FIRST_SHIFT_MM = 0;

// Build a factory-local part map for a given Date
function partsInFactory(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: FACTORY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => fmt.find((p) => p.type === t)?.value!;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  return {
    year,
    month,
    day,
    hour,
    minute,
    dateKey: `${year}-${month}-${day}`,
    timeKey: `${hour}:00`,
    minutesOfDay: +hour * 60 + +minute,
  };
}

// Render a factory-local ISO-like string (no trailing Z) for display
function factoryLocalISO(dateKey: string, hh: number, mm: number) {
  const h = String(hh).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  return `${dateKey}T${h}:${m}:00`;
}

// Compute preferred minutes for a stage instance
function pickPlannedMinutes(row: any) {
  const sched = row.scheduled_minutes ?? null;
  const est = row.estimated_duration_minutes ?? 0;
  const setup = row.setup_time_minutes ?? 0;
  const actual = row.actual_duration_minutes ?? 0;
  const diff =
    row.scheduled_start_at && row.scheduled_end_at
      ? Math.max(
          0,
          Math.round(
            (new Date(row.scheduled_end_at).getTime() -
              new Date(row.scheduled_start_at).getTime()) / 60000
          )
        )
      : 0;

  if (typeof sched === "number" && sched > 0) return sched;
  if (est + setup > 0) return est + setup;
  if (est > 0) return est;
  if (actual > 0) return actual;
  return diff || 60; // last-resort default
}

/* ------------------------ hook --------------------------- */

export function useScheduleReader() {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1) Pull scheduled stage instances (+ minute fields we need)
      const { data: stageInstances, error: stagesError } = await supabase
        .from("job_stage_instances")
        .select(
          `
          id,
          job_id,
          production_stage_id,
          stage_order,
          estimated_duration_minutes,
          setup_time_minutes,
          actual_duration_minutes,
          scheduled_minutes,
          scheduled_start_at,
          scheduled_end_at,
          status,
          job_table_name,
          notes
        `
        )
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

      // 2) get unique lookups
      const stageIds = [...new Set(stageInstances.map((s) => s.production_stage_id))];
      const jobIds = [...new Set(stageInstances.map((s) => s.job_id))];

      // 3) stage lookup
      const { data: productionStages, error: stagesLookupError } = await supabase
        .from("production_stages")
        .select("id, name, color")
        .in("id", stageIds);

      if (stagesLookupError) {
        console.error("Error fetching production stages:", stagesLookupError);
      }

      // 4) job lookup
      const { data: productionJobs, error: jobsError } = await supabase
        .from("production_jobs")
        .select("id, wo_no")
        .in("id", jobIds);

      if (jobsError) {
        console.error("Error fetching production jobs:", jobsError);
      }

      // 5) Fetch job specifications once per job (following useJobSpecificationDisplay pattern)
      const jobSpecifications = new Map();
      
      // Helper function to determine stage type
      const getStageType = (stageName: string) => {
        const name = stageName.toLowerCase();
        if (name.includes('printing') || name.includes('print') || name.includes('hp') || 
            name.includes('xerox') || name.includes('t250') || name.includes('7900') || 
            name.includes('12000') || name.includes('envelope printing') || 
            name.includes('large format')) {
          return 'printing';
        }
        if (name.includes('laminating')) {
          return 'laminating';
        }
        if (name.includes('uv varnish') || name.includes('uv varnishing')) {
          return 'uv_varnish';
        }
        return 'other';
      };
      
      // Fetch specifications for each unique job (once per job)
      for (const jobId of jobIds) {
        try {
          const { data: specs, error: specsError } = await supabase
            .rpc('get_job_specifications', {
              p_job_id: jobId,
              p_job_table_name: 'production_jobs'
            });
          
          if (!specsError && specs) {
            // Store specifications by category for this job
            const jobSpecs: Record<string, string> = {};
            (specs || []).forEach((spec: any) => {
              jobSpecs[spec.category] = spec.display_name;
            });
            jobSpecifications.set(jobId, jobSpecs);
          }
        } catch (err) {
          console.warn(`Failed to fetch specifications for job ${jobId}:`, err);
        }
      }
      
      // Also extract paper specs from notes for each job
      const jobPaperSpecs = new Map();
      const stagesByJob = new Map<string, any[]>();
      for (const instance of stageInstances) {
        if (!stagesByJob.has(instance.job_id)) {
          stagesByJob.set(instance.job_id, []);
        }
        stagesByJob.get(instance.job_id)!.push(instance);
      }
      
      // Extract paper specs from notes for each job
      for (const [jobId, instances] of stagesByJob) {
        for (const instance of instances) {
          if (instance.notes) {
            const parsedSpecs = parsePaperSpecsFromNotes(instance.notes);
            if (parsedSpecs.paperType || parsedSpecs.paperWeight) {
              const paperDisplay = formatPaperDisplay(parsedSpecs);
              if (paperDisplay) {
                jobPaperSpecs.set(jobId, {
                  paper_type: parsedSpecs.paperType,
                  paper_weight: parsedSpecs.paperWeight,
                  paper_display: paperDisplay
                });
                break; // Found paper specs for this job, no need to check other instances
              }
            }
          }
        }
      }

      // 6) maps
      const stageMap = new Map((productionStages || []).map((s) => [s.id, s]));
      const jobMap = new Map((productionJobs || []).map((j) => [j.id, j]));

      // 7) Group by factory-local date + hour slots
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

      for (const row of stageInstances) {
        const start = new Date(row.scheduled_start_at);
        const end = new Date(row.scheduled_end_at);

        const startP = partsInFactory(start);
        const endP = partsInFactory(end);

        const stage = stageMap.get(row.production_stage_id);
        const job = jobMap.get(row.job_id);
        
        // Get appropriate specifications based on stage type
        const jobSpecs = jobSpecifications.get(row.job_id) || {};
        const paperSpecs = jobPaperSpecs.get(row.job_id);
        const stageType = stage ? getStageType(stage.name) : 'other';
        
        let displaySpec = undefined;
        if (stageType === 'printing' && paperSpecs) {
          displaySpec = paperSpecs.paper_display;
        } else if (stageType === 'laminating' && jobSpecs.lamination_type) {
          displaySpec = jobSpecs.lamination_type;
        } else if (stageType === 'uv_varnish' && jobSpecs.uv_varnish) {
          displaySpec = jobSpecs.uv_varnish;
        }

        // total planned minutes
        const planned = pickPlannedMinutes(row);

        // Build a function to push a card into scheduleMap
        const pushCard = (
          dateKey: string,
          slotKey: string,
          minutes: number,
          dispStartISO: string,
          dispEndISO: string,
          isCarry = false
        ) => {
          if (!scheduleMap.has(dateKey)) scheduleMap.set(dateKey, new Map());
          const dayMap = scheduleMap.get(dateKey)!;
          if (!dayMap.has(slotKey)) dayMap.set(slotKey, []);

          dayMap.get(slotKey)!.push({
            id: row.id + (isCarry ? "-carry" : ""),
            job_id: row.job_id,
            job_wo_no: job?.wo_no || "Unknown",
            production_stage_id: row.production_stage_id,
            stage_name: stage?.name || "Unknown Stage",
            stage_order: row.stage_order,
            estimated_duration_minutes: Math.max(0, minutes),
            start_hhmm: dispStartISO,
            end_hhmm: dispEndISO,
            status: row.status,
            stage_color: stage?.color || "#6B7280",
            paper_type: stageType === 'printing' && paperSpecs ? paperSpecs.paper_type : undefined,
            paper_weight: stageType === 'printing' && paperSpecs ? paperSpecs.paper_weight : undefined,
            paper_display: displaySpec,
            // is_carry: isCarry,
          });
        };

        // Single-day slot (factory-local)
        if (startP.dateKey === endP.dateKey) {
          const minutes = planned; // all minutes on the same day
          pushCard(
            startP.dateKey,
            startP.timeKey,
            minutes,
            factoryLocalISO(startP.dateKey, +startP.hour, +startP.minute),
            factoryLocalISO(endP.dateKey, +endP.hour, +endP.minute),
            false
          );
        } else {
          // Cross-midnight: split into two segments.
          // Carry starts at next day's first shift; carry minutes = end - 08:00
          const carryStartMin = FIRST_SHIFT_HH * 60 + FIRST_SHIFT_MM;
          const carryMinutes = Math.max(0, endP.minutesOfDay - carryStartMin);

          // Remaining minutes stay on the starting day
          const firstDayMinutes = Math.max(0, planned - carryMinutes);

          // 1) First segment (original day, keep original start; end at 23:59 conceptually)
          pushCard(
            startP.dateKey,
            startP.timeKey,
            firstDayMinutes,
            factoryLocalISO(startP.dateKey, +startP.hour, +startP.minute),
            // Display the real end, because your card shows a time range; the minutes chip still reflects firstDayMinutes
            factoryLocalISO(endP.dateKey, +endP.hour, +endP.minute),
            false
          );

          // 2) Carry segment (next day 08:00 -> real end)
          pushCard(
            endP.dateKey,
            "08:00",
            carryMinutes,
            factoryLocalISO(endP.dateKey, FIRST_SHIFT_HH, FIRST_SHIFT_MM),
            factoryLocalISO(endP.dateKey, +endP.hour, +endP.minute),
            true
          );
        }
      }

      // 7) Convert to array format
      const days: ScheduleDayData[] = [];

      scheduleMap.forEach((dayMap, dateKey) => {
        // keep your fixed slots order
        const timeSlotData: TimeSlotData[] = timeSlots.map((slot) => ({
          time_slot: slot,
          scheduled_stages: dayMap.get(slot) || [],
        }));

        const flat = Array.from(dayMap.values()).flat();
        const totalStages = flat.length;
        const totalMinutes = flat.reduce(
          (sum, s) => sum + (s.estimated_duration_minutes || 0),
          0
        );

        // Build a Date from the factory-local date for the label
        const [yy, mm, dd] = dateKey.split("-").map((n) => +n);
        const labelDate = new Date(yy, mm - 1, dd, 12, 0, 0); // midday to avoid DST edge

        days.push({
          date: dateKey,
          day_name: labelDate.toLocaleDateString("en-GB", { weekday: "long" }),
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
    } catch (error) {
      console.error("Error in fetchSchedule:", error);
      toast.error("Failed to fetch schedule data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // CRITICAL FIX: Use the correct scheduler wrapper function
  const triggerReschedule = useCallback(async () => {
    try {
      console.log("🔄 Triggering reschedule via simple_scheduler_wrapper...");
      const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
        p_mode: 'reschedule_all' // Use the wrapper with reschedule_all mode
      });
      if (error) {
        console.error("Error triggering reschedule:", error);
        toast.error("Failed to trigger reschedule");
        return false;
      }
      console.log("✅ Reschedule triggered successfully:", data);
      const result = data as any;
      const scheduledCount = result?.scheduled_count ?? 0;
      const wroteSlots = result?.wrote_slots ?? 0;
      toast.success(`Successfully rescheduled ${scheduledCount} stages (${wroteSlots} time slots)`);

      // Refresh after a moment
      setTimeout(() => {
        fetchSchedule();
      }, 2000);
      return true;
    } catch (error) {
      console.error("Error triggering reschedule:", error);
      toast.error("Failed to trigger reschedule");
      return false;
    }
  }, [fetchSchedule]);

  return {
    scheduleDays,
    isLoading,
    fetchSchedule,
    triggerReschedule,
  };
}
