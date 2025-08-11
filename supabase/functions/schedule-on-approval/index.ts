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
  
  // PHASE 2 FIX: Calculate if job fits BEFORE scheduling
  const dayEnd = withTime(current, WORK_END_HOUR, WORK_END_MINUTE);
  const availableInDay = Math.max(0, Math.floor((dayEnd.getTime() - current.getTime()) / 60000));
  
  console.log(`[addWorkingMinutes] Day: ${current.toISOString()}, Available: ${availableInDay} min, Required: ${minutes} min`);
  
  // If job doesn't fit in current day, move ENTIRE job to next working day start
  if (minutes > availableInDay) {
    console.log(`[addWorkingMinutes] Job doesn't fit (${minutes} > ${availableInDay}), moving entire job to next day`);
    const nextDay = new Date(current);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    current = await nextWorkingStart(withTime(nextDay, WORK_START_HOUR, 0));
    console.log(`[addWorkingMinutes] Job moved to next day: ${current.toISOString()}`);
  }
  
  // Job fits in current day - schedule consecutively from start time
  const endTime = new Date(current.getTime() + minutes * 60000);
  console.log(`[addWorkingMinutes] Job scheduled: ${current.toISOString()} → ${endTime.toISOString()}`);
  
  // VALIDATION: Ensure end time is within working hours (should never happen now)
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

    let pointer = new Date();
    let lastEnd: Date | null = null;
    const scheduleResults: Array<{ stage_instance_id: UUID; start: string; end: string; minutes: number }> = [];

    console.log(`[schedule-on-approval] Scheduling ${stages?.length} stages for job ${jobId}`);

    for (const s of (stages as StageInstance[])) {
      const minutes = s.estimated_duration_minutes ?? 60; // default 1h
      console.log(`[schedule-on-approval] === STAGE ${s.stage_order}: ${s.production_stage_id}, Duration: ${minutes} min ===`);
      
      // PHASE 1 FIX: STRICT WORKFLOW-FIRST SCHEDULING
      // Step 1: Get workflow dependency start time (previous stage completion)
      let workflowStartTime = pointer; // Default to current pointer
      
      if (s.stage_order > 1) {
        const { data: prevStages } = await supabase
          .from("job_stage_instances")
          .select("scheduled_end_at, stage_order, production_stage_id")
          .eq("job_id", jobId)
          .eq("job_table_name", jobTable)
          .lt("stage_order", s.stage_order)
          .order("stage_order", { ascending: false })
          .limit(1);
        
        if (prevStages && prevStages.length > 0 && prevStages[0].scheduled_end_at) {
          workflowStartTime = new Date(prevStages[0].scheduled_end_at);
          console.log(`[schedule-on-approval] WORKFLOW DEPENDENCY: Previous stage (order ${prevStages[0].stage_order}) ends at: ${workflowStartTime.toISOString()}`);
        } else {
          console.error(`[schedule-on-approval] ERROR: Stage ${s.stage_order} missing previous stage completion time - workflow dependency violated!`);
          // Force to use pointer as fallback
        }
      }
      
      // Step 2: Get current queue end time for this stage
      const queueEnd = await getStageQueueEndTime(s.production_stage_id);
      console.log(`[schedule-on-approval] QUEUE STATUS: Stage ${s.production_stage_id} queue ends at: ${queueEnd.toISOString()}`);
      
      // PHASE 1 FIX: WORKFLOW DEPENDENCIES TAKE PRIORITY
      // Schedule at the LATER of: workflow dependency OR queue end
      let scheduledStart = new Date(Math.max(workflowStartTime.getTime(), queueEnd.getTime()));
      console.log(`[schedule-on-approval] SCHEDULING CONSTRAINT: Workflow=${workflowStartTime.toISOString()}, Queue=${queueEnd.toISOString()}, Chosen=${scheduledStart.toISOString()}`);
      
      if (expedited) {
        console.log(`[schedule-on-approval] Job ${jobId} is expedited - but still respecting workflow dependencies`);
        // Expedited jobs jump queue but cannot start before workflow allows
        scheduledStart = new Date(Math.max(workflowStartTime.getTime(), queueEnd.getTime()));
      }

      // Ensure scheduled start is within working hours
      scheduledStart = await nextWorkingStart(scheduledStart);
      console.log(`[schedule-on-approval] WORKING HOURS ADJUSTED: ${scheduledStart.toISOString()}`);
      
      const scheduledEnd = await addWorkingMinutes(scheduledStart, minutes);
      console.log(`[schedule-on-approval] FINAL SCHEDULE: Stage ${s.stage_order} → ${scheduledStart.toISOString()} to ${scheduledEnd.toISOString()}`);

      // PHASE 4 VALIDATION: Comprehensive checks
      const startDay = toDateOnly(scheduledStart);
      const endDay = toDateOnly(scheduledEnd);
      if (startDay !== endDay) {
        console.error(`[schedule-on-approval] VALIDATION ERROR: Job spans days ${startDay} to ${endDay} - WORKFLOW DEPENDENCY VIOLATION!`);
        throw new Error(`Stage ${s.stage_order} spans overnight: ${startDay} to ${endDay}`);
      }
      
      // Validate working hours
      const startHour = scheduledStart.getUTCHours();
      const endHour = scheduledEnd.getUTCHours();
      const endMinute = scheduledEnd.getUTCMinutes();
      if (startHour < WORK_START_HOUR || endHour > WORK_END_HOUR || (endHour === WORK_END_HOUR && endMinute > WORK_END_MINUTE)) {
        console.error(`[schedule-on-approval] VALIDATION ERROR: Stage outside working hours: ${scheduledStart.toISOString()} to ${scheduledEnd.toISOString()}`);
        throw new Error(`Stage ${s.stage_order} scheduled outside working hours (08:00-16:30)`);
      }
      
      // Validate workflow dependency
      if (s.stage_order > 1 && scheduledStart < workflowStartTime) {
        console.error(`[schedule-on-approval] VALIDATION ERROR: Stage ${s.stage_order} starts before workflow allows: ${scheduledStart.toISOString()} < ${workflowStartTime.toISOString()}`);
        throw new Error(`Stage ${s.stage_order} violates workflow dependency`);
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

      // PHASE 3 FIX: Update queue end time AFTER workflow enforcement
      await updateStageQueueEndTime(s.production_stage_id, scheduledEnd);
      console.log(`[schedule-on-approval] QUEUE UPDATED: Stage ${s.production_stage_id} queue now ends at: ${scheduledEnd.toISOString()}`);

      scheduleResults.push({ stage_instance_id: s.id, start: scheduledStart.toISOString(), end: scheduledEnd.toISOString(), minutes });
      lastEnd = new Date(scheduledEnd);
      pointer = lastEnd; // Update pointer for next stage workflow dependency
      console.log(`[schedule-on-approval] POINTER UPDATED: Next stage will start after: ${pointer.toISOString()}`);
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
