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
  let current = await nextWorkingStart(start);
  
  console.log(`[addWorkingMinutes] Adding ${minutes} minutes to ${current.toISOString()}`);
  
  // Calculate if job fits in current day BEFORE scheduling
  const dayEnd = withTime(current, WORK_END_HOUR, WORK_END_MINUTE);
  const availableInDay = Math.max(0, Math.floor((dayEnd.getTime() - current.getTime()) / 60000));
  
  console.log(`[addWorkingMinutes] Day: ${current.toISOString()}, Available: ${availableInDay} min, Required: ${minutes} min`);
  
  // If job doesn't fit, move ENTIRE job to next working day start
  if (minutes > availableInDay) {
    console.log(`[addWorkingMinutes] Job doesn't fit (${minutes} > ${availableInDay}), moving entire job to next day`);
    const nextDay = new Date(current);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    current = await nextWorkingStart(withTime(nextDay, WORK_START_HOUR, 0));
    console.log(`[addWorkingMinutes] Job moved to next day: ${current.toISOString()}`);
  }
  
  // Job fits in current day - schedule from start time
  const endTime = new Date(current.getTime() + minutes * 60000);
  console.log(`[addWorkingMinutes] Job scheduled: ${current.toISOString()} → ${endTime.toISOString()}`);
  
  // VALIDATION: Ensure end time is within working hours
  const finalDayEnd = withTime(current, WORK_END_HOUR, WORK_END_MINUTE);
  if (endTime > finalDayEnd) {
    console.error(`[addWorkingMinutes] CRITICAL ERROR: End time ${endTime.toISOString()} exceeds day end ${finalDayEnd.toISOString()}`);
    throw new Error(`Job scheduling error: Job would end at ${endTime.toISOString()} but day ends at ${finalDayEnd.toISOString()}`);
  }
  
  return endTime;
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
    const scheduleResults: Array<{ stage_instance_id: UUID; start: string; end: string; minutes: number }> = [];

    console.log(`[schedule-on-approval] === SEQUENTIAL WORKFLOW SCHEDULING ===`);
    console.log(`[schedule-on-approval] Scheduling ${stages?.length} stages for job ${jobId} (expedited: ${expedited})`);

    // COMPLETE REWRITE: STRICT SEQUENTIAL WORKFLOW PROCESSING
    let previousStageEndTime: Date | null = null;

    for (const s of (stages as StageInstance[])) {
      const minutes = s.estimated_duration_minutes ?? 60; // default 1h
      console.log(`[schedule-on-approval] === STAGE ${s.stage_order}: ${s.production_stage_id}, Duration: ${minutes} min ===`);
      
      // STEP 1: Determine earliest start time based on workflow dependencies
      let earliestWorkflowStart: Date;
      
      if (s.stage_order === 1) {
        // First stage: can start immediately (subject to queue)
        earliestWorkflowStart = new Date();
        console.log(`[schedule-on-approval] FIRST STAGE: Can start immediately`);
      } else {
        // Subsequent stages: MUST wait for previous stage to complete
        if (!previousStageEndTime) {
          console.error(`[schedule-on-approval] CRITICAL ERROR: Stage ${s.stage_order} has no previous stage completion time!`);
          throw new Error(`Workflow dependency violation: Stage ${s.stage_order} missing previous stage data`);
        }
        earliestWorkflowStart = new Date(previousStageEndTime);
        console.log(`[schedule-on-approval] WORKFLOW DEPENDENCY: Stage ${s.stage_order} cannot start before ${earliestWorkflowStart.toISOString()}`);
      }
      
      // STEP 2: Get current queue end time for this specific stage
      const stageQueueEndTime = await getStageQueueEndTime(s.production_stage_id);
      console.log(`[schedule-on-approval] STAGE QUEUE: Stage ${s.production_stage_id} queue ends at ${stageQueueEndTime.toISOString()}`);
      
      // STEP 3: ENFORCE SEQUENTIAL WORKFLOW - stage starts at LATER of workflow dependency OR queue end
      let actualStartTime = new Date(Math.max(earliestWorkflowStart.getTime(), stageQueueEndTime.getTime()));
      console.log(`[schedule-on-approval] SCHEDULING CONSTRAINT: Workflow=${earliestWorkflowStart.toISOString()}, Queue=${stageQueueEndTime.toISOString()}`);
      console.log(`[schedule-on-approval] CHOSEN START TIME: ${actualStartTime.toISOString()}`);
      
      // Handle expedited jobs (they can jump their stage queue but still respect workflow)
      if (expedited && s.stage_order > 1) {
        // Expedited jobs skip queue but CANNOT start before workflow allows
        actualStartTime = earliestWorkflowStart;
        console.log(`[schedule-on-approval] EXPEDITED: Stage starts at workflow dependency time: ${actualStartTime.toISOString()}`);
      }

      // STEP 4: Ensure start time is within working hours
      actualStartTime = await nextWorkingStart(actualStartTime);
      console.log(`[schedule-on-approval] WORKING HOURS ADJUSTED: ${actualStartTime.toISOString()}`);
      
      // STEP 5: Calculate end time (with proper day boundary handling)
      const actualEndTime = await addWorkingMinutes(actualStartTime, minutes);
      console.log(`[schedule-on-approval] FINAL SCHEDULE: Stage ${s.stage_order} → ${actualStartTime.toISOString()} to ${actualEndTime.toISOString()}`);

      // STEP 6: COMPREHENSIVE VALIDATION
      // Validate no overnight spanning
      const startDay = toDateOnly(actualStartTime);
      const endDay = toDateOnly(actualEndTime);
      if (startDay !== endDay) {
        console.error(`[schedule-on-approval] VALIDATION ERROR: Stage spans days ${startDay} to ${endDay}`);
        throw new Error(`Stage ${s.stage_order} spans overnight: ${startDay} to ${endDay}`);
      }
      
      // Validate working hours
      const startHour = actualStartTime.getUTCHours();
      const endHour = actualEndTime.getUTCHours();
      const endMinute = actualEndTime.getUTCMinutes();
      if (startHour < WORK_START_HOUR || endHour > WORK_END_HOUR || (endHour === WORK_END_HOUR && endMinute > WORK_END_MINUTE)) {
        console.error(`[schedule-on-approval] VALIDATION ERROR: Stage outside working hours: ${actualStartTime.toISOString()} to ${actualEndTime.toISOString()}`);
        throw new Error(`Stage ${s.stage_order} scheduled outside working hours (08:00-16:30)`);
      }
      
      // Validate workflow dependency (critical check)
      if (s.stage_order > 1 && actualStartTime < earliestWorkflowStart) {
        console.error(`[schedule-on-approval] VALIDATION ERROR: Stage ${s.stage_order} starts before workflow allows`);
        throw new Error(`Stage ${s.stage_order} violates workflow dependency: starts at ${actualStartTime.toISOString()} but must wait until ${earliestWorkflowStart.toISOString()}`);
      }

      // STEP 7: Update stage instance in database
      const { error: updateErr } = await supabase
        .from("job_stage_instances")
        .update({
          scheduled_start_at: actualStartTime.toISOString(),
          scheduled_end_at: actualEndTime.toISOString(),
          scheduled_minutes: minutes,
          schedule_status: "scheduled",
        })
        .eq("id", s.id);

      if (updateErr) {
        console.error("Failed updating stage schedule", s.id, updateErr);
        continue; // proceed with others
      }

      // STEP 8: Update stage queue end time for future jobs in same stage
      await updateStageQueueEndTime(s.production_stage_id, actualEndTime);
      console.log(`[schedule-on-approval] QUEUE UPDATED: Stage ${s.production_stage_id} queue now ends at ${actualEndTime.toISOString()}`);

      // STEP 9: Record results and update pointer for next stage
      scheduleResults.push({ 
        stage_instance_id: s.id, 
        start: actualStartTime.toISOString(), 
        end: actualEndTime.toISOString(), 
        minutes 
      });
      
      // CRITICAL: Update previousStageEndTime for sequential workflow
      previousStageEndTime = new Date(actualEndTime);
      console.log(`[schedule-on-approval] WORKFLOW POINTER UPDATED: Next stage (${s.stage_order + 1}) cannot start before: ${previousStageEndTime.toISOString()}`);
    }

    // Update job completion and due dates
    if (previousStageEndTime) {
      const internalCompletionDate = toDateOnly(previousStageEndTime);
      const dueDate = await computeDueDateFromCompletion(previousStageEndTime);

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

    console.log(`[schedule-on-approval] === SCHEDULING COMPLETE ===`);
    console.log(`[schedule-on-approval] Job ${jobId} scheduled ${scheduleResults.length} stages sequentially`);

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