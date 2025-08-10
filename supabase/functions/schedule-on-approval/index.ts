import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UUID = string;

interface SchedulingRequest {
  job_id: UUID;
  job_table_name?: string; // default 'production_jobs'
}

interface StageInstance {
  id: UUID;
  production_stage_id: UUID;
  stage_order: number;
  status: string;
  estimated_duration_minutes: number | null;
  started_at: string | null;
  proof_approved_manually_at: string | null;
}

// Working hours configuration (can be extended from DB later)
const WORK_START_HOUR = 8; // 08:00
const WORK_END_HOUR = 16; // 16:30 handled via minutes
const WORK_END_MINUTE = 30;
const DAILY_CAPACITY_MINUTES = 510; // 8.5 hours (8:00-16:30)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://kgizusgqexmlfcqfjopk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SERVICE_ROLE_KEY) {
  console.warn("SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY not set - updates may fail due to RLS");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "");

function toDateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function isHoliday(date: Date): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_public_holiday", {
      check_date: toDateOnly(date),
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

async function isWorkingDay(date: Date): Promise<boolean> {
  const day = date.getUTCDay(); // 0 Sun .. 6 Sat (UTC)
  if (day === 0 || day === 6) return false;
  return !(await isHoliday(date));
}

function withTime(date: Date, hour: number, minute = 0) {
  const d = new Date(date);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function nextWorkingStart(from: Date): Promise<Date> {
  let d = new Date(from);
  // Align to working window
  while (!(await isWorkingDay(d))) {
    d.setUTCDate(d.getUTCDate() + 1);
    d = withTime(d, WORK_START_HOUR, 0);
  }
  const workStart = withTime(d, WORK_START_HOUR, 0);
  const workEnd = withTime(d, WORK_END_HOUR, WORK_END_MINUTE);
  if (d < workStart) return workStart;
  if (d > workEnd) {
    // move to next day start
    const n = new Date(d);
    n.setUTCDate(n.getUTCDate() + 1);
    return nextWorkingStart(withTime(n, WORK_START_HOUR, 0));
  }
  return d;
}

async function addWorkingMinutes(start: Date, minutes: number): Promise<Date> {
  let remaining = minutes;
  let current = await nextWorkingStart(start);
  
  console.log(`[addWorkingMinutes] Adding ${minutes} minutes to ${current.toISOString()}`);
  
  while (remaining > 0) {
    const dayEnd = withTime(current, WORK_END_HOUR, WORK_END_MINUTE);
    const availableInDay = Math.max(0, Math.floor((dayEnd.getTime() - current.getTime()) / 60000));
    
    console.log(`[addWorkingMinutes] Day: ${current.toISOString()}, Available: ${availableInDay} min, Remaining: ${remaining} min`);
    
    if (remaining <= availableInDay) {
      // Job fits in current day - schedule consecutively
      const endTime = new Date(current.getTime() + remaining * 60000);
      console.log(`[addWorkingMinutes] Job fits in day, ending at: ${endTime.toISOString()}`);
      
      // Validate end time is within working hours
      if (endTime > dayEnd) {
        console.log(`[addWorkingMinutes] End time ${endTime.toISOString()} exceeds day end ${dayEnd.toISOString()}, moving to next day`);
        const nextDay = new Date(current);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        current = await nextWorkingStart(withTime(nextDay, WORK_START_HOUR, 0));
        continue; // Try again on next day
      }
      
      return endTime;
    }
    
    // Job doesn't fit - move ENTIRE job to next working day start
    console.log(`[addWorkingMinutes] Job doesn't fit (${remaining} > ${availableInDay}), moving entire job to next day`);
    const nextDay = new Date(current);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    current = await nextWorkingStart(withTime(nextDay, WORK_START_HOUR, 0));
    // Keep full remaining duration for next day (don't subtract anything)
  }
  return current;
}

async function getStageQueueEndTime(stageId: UUID): Promise<Date> {
  // Use the new database function to get queue end time
  const { data, error } = await supabase.rpc('get_stage_queue_end_time', {
    p_stage_id: stageId,
    p_date: toDateOnly(new Date())
  });
  
  if (error || !data) {
    console.error('Error getting stage queue end time:', error);
    // Fallback to start of next working day
    return await nextWorkingStart(new Date());
  }
  
  console.log(`[getStageQueueEndTime] Stage ${stageId} queue ends at: ${data}`);
  return new Date(data);
}

async function updateStageQueueEndTime(stageId: UUID, newEndTime: Date): Promise<void> {
  // Use the new database function to update queue end time
  const { error } = await supabase.rpc('update_stage_queue_end_time', {
    p_stage_id: stageId,
    p_new_end_time: newEndTime.toISOString(),
    p_date: toDateOnly(newEndTime)
  });
  
  if (error) {
    console.error('Error updating stage queue end time:', error);
  } else {
    console.log(`[updateStageQueueEndTime] Updated stage ${stageId} queue to end at: ${newEndTime.toISOString()}`);
  }
}

async function getJobIsExpedited(jobId: UUID): Promise<boolean> {
  const { data, error } = await supabase
    .from("production_jobs")
    .select("is_expedited")
    .eq("id", jobId)
    .single();
  if (error || !data) return false;
  return Boolean(data.is_expedited);
}

async function computeDueDateFromCompletion(completion: Date): Promise<string> {
  // Add 1 working day buffer
  const withBuffer = await addWorkingMinutes(completion, (8 * 60));
  return toDateOnly(withBuffer);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SchedulingRequest;
    const jobId = body.job_id;
    const jobTable = body.job_table_name ?? "production_jobs";

    console.log("[schedule-on-approval] start job", jobId, jobTable);

    // Fetch stages for this job
    const { data: stages, error: stagesError } = await supabase
      .from("job_stage_instances")
      .select("id, production_stage_id, stage_order, status, estimated_duration_minutes, started_at, proof_approved_manually_at")
      .eq("job_id", jobId)
      .eq("job_table_name", jobTable)
      .in("status", ["pending", "active"]) // schedule pending/active forward
      .order("stage_order", { ascending: true });

    if (stagesError) {
      console.error("Failed to fetch stages", stagesError);
      return new Response(JSON.stringify({ error: stagesError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expedited = await getJobIsExpedited(jobId);

    let pointer = new Date();
    let lastEnd: Date | null = null;
    const scheduleResults: Array<{ stage_instance_id: UUID; start: string; end: string; minutes: number }> = [];

    console.log(`[schedule-on-approval] Scheduling ${stages?.length} stages for job ${jobId}`);

    for (const s of (stages as StageInstance[])) {
      const minutes = s.estimated_duration_minutes ?? 60; // default 1h
      console.log(`[schedule-on-approval] Stage: ${s.production_stage_id}, Duration: ${minutes} min, Order: ${s.stage_order}`);
      
      // SEQUENTIAL STAGE DEPENDENCY: Check if previous stages are scheduled
      if (s.stage_order > 1) {
        const { data: prevStages } = await supabase
          .from("job_stage_instances")
          .select("scheduled_end_at")
          .eq("job_id", jobId)
          .eq("job_table_name", jobTable)
          .lt("stage_order", s.stage_order)
          .order("stage_order", { ascending: false })
          .limit(1);
        
        if (prevStages && prevStages.length > 0 && prevStages[0].scheduled_end_at) {
          const prevEndTime = new Date(prevStages[0].scheduled_end_at);
          console.log(`[schedule-on-approval] Previous stage ends at: ${prevEndTime.toISOString()}`);
          
          // Current stage cannot start before previous stage ends
          pointer = prevEndTime;
        }
      }
      
      // Get current queue end time for this stage
      const queueEnd = await getStageQueueEndTime(s.production_stage_id);
      
      // Schedule at the later of: queue end OR previous stage completion
      let scheduledStart = new Date(Math.max(queueEnd.getTime(), pointer.getTime()));
      
      if (expedited) {
        console.log(`[schedule-on-approval] Job ${jobId} is expedited - using queue position`);
        // For expedited jobs, still respect workflow dependencies
      }

      // Ensure scheduled start is within working hours
      scheduledStart = await nextWorkingStart(scheduledStart);
      const scheduledEnd = await addWorkingMinutes(scheduledStart, minutes);

      console.log(`[schedule-on-approval] Stage ${s.stage_order} scheduled: ${scheduledStart.toISOString()} - ${scheduledEnd.toISOString()}`);

      // VALIDATION: Ensure no overnight spanning
      const startDay = toDateOnly(scheduledStart);
      const endDay = toDateOnly(scheduledEnd);
      if (startDay !== endDay) {
        console.error(`[schedule-on-approval] ERROR: Job spans days ${startDay} to ${endDay} - this should not happen!`);
      }

      // Update the stage instance in the database
      const { error: updateErr } = await supabase
        .from("job_stage_instances")
        .update({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          scheduled_minutes: minutes,
          schedule_status: "scheduled",
        })
        .eq("id", s.id);

      if (updateErr) {
        console.error("Failed updating stage schedule", s.id, updateErr);
        continue; // proceed with others
      }

      // Update the stage queue end time for consecutive scheduling
      await updateStageQueueEndTime(s.production_stage_id, scheduledEnd);

      scheduleResults.push({ stage_instance_id: s.id, start: scheduledStart.toISOString(), end: scheduledEnd.toISOString(), minutes });
      lastEnd = new Date(scheduledEnd);
      pointer = lastEnd; // Update pointer for next stage dependency
    }

    if (lastEnd) {
      // Update job dates: internal_completion_date and due_date (+1 working day buffer)
      const internalCompletionDate = toDateOnly(lastEnd);
      const dueDate = await computeDueDateFromCompletion(lastEnd);

      // Fetch job lock status
      const { data: jobData } = await supabase
        .from("production_jobs")
        .select("due_date_locked")
        .eq("id", jobId)
        .single();

      const updatePayload: Record<string, any> = {
        internal_completion_date: internalCompletionDate,
        last_due_date_check: new Date().toISOString(),
      };
      if (!jobData || jobData.due_date_locked !== true) {
        updatePayload.due_date = dueDate;
        updatePayload.due_date_warning_level = "green";
      }

      const { error: jobUpdateErr } = await supabase
        .from("production_jobs")
        .update(updatePayload)
        .eq("id", jobId);
      if (jobUpdateErr) {
        console.error("Failed updating job dates", jobUpdateErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, scheduled: scheduleResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[schedule-on-approval] error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
