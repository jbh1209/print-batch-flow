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

    console.log("🚀 [PARALLEL-AWARE SCHEDULING] Starting job", jobId, jobTable);

    // Fetch stages for this job WITH parallel processing information
    const { data: stages, error: stagesError } = await supabase
      .from("job_stage_instances")
      .select(`
        id, 
        production_stage_id, 
        stage_order, 
        status, 
        estimated_duration_minutes, 
        part_assignment,
        dependency_group,
        production_stages!inner (
          id,
          name,
          supports_parts
        )
      `)
      .eq("job_id", jobId)
      .eq("job_table_name", jobTable)
      .in("status", ["pending", "active"])
      .order("stage_order", { ascending: true });

    if (stagesError) {
      console.error("❌ Failed to fetch stages", stagesError);
      return new Response(JSON.stringify({ error: stagesError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!stages || stages.length === 0) {
      console.log("ℹ️ No pending stages found for job");
      return new Response(JSON.stringify({ ok: true, scheduled: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expedited = await getJobIsExpedited(jobId);
    const scheduleResults: Array<{ stage_instance_id: UUID; start: string; end: string; minutes: number }> = [];

    console.log(`📋 Found ${stages.length} stages to schedule (expedited: ${expedited})`);

    // STEP 1: ANALYZE WORKFLOW STRUCTURE - Group stages by workflow path
    const workflowPaths: Record<string, any[]> = {};
    const convergenceStages: any[] = [];

    for (const stage of stages) {
      const partAssignment = stage.part_assignment || 'main';
      const stageName = stage.production_stages?.name || 'Unknown';
      
      console.log(`🔍 Analyzing stage: ${stageName} (order ${stage.stage_order}, part: ${partAssignment})`);
      
      if (partAssignment === 'both') {
        // Convergence points - wait for ALL parallel paths to complete
        convergenceStages.push(stage);
        console.log(`🔗 Added to convergence stages: ${stageName}`);
      } else {
        // Parallel workflow paths
        if (!workflowPaths[partAssignment]) {
          workflowPaths[partAssignment] = [];
        }
        workflowPaths[partAssignment].push(stage);
        console.log(`🛤️ Added to workflow path '${partAssignment}': ${stageName}`);
      }
    }

    console.log(`🔀 Workflow analysis complete:`);
    console.log(`   • Parallel paths: ${Object.keys(workflowPaths).length} (${Object.keys(workflowPaths).join(', ')})`);
    console.log(`   • Convergence stages: ${convergenceStages.length}`);

    // STEP 2: PROCESS PARALLEL PATHS SEPARATELY
    const pathCompletionTimes: Record<string, Date> = {};

    for (const [pathName, pathStages] of Object.entries(workflowPaths)) {
      console.log(`\n🛤️ === PROCESSING WORKFLOW PATH: ${pathName.toUpperCase()} ===`);
      
      // Sort stages in this path by stage_order to enforce workflow sequence
      pathStages.sort((a, b) => a.stage_order - b.stage_order);
      console.log(`📊 Path stages: ${pathStages.map(s => `${s.production_stages?.name}(${s.stage_order})`).join(' → ')}`);
      
      let pathCurrentTime = await nextWorkingStart(new Date());
      
      for (const stage of pathStages) {
        const stageId = stage.production_stage_id;
        const stageName = stage.production_stages?.name || 'Unknown';
        const minutes = stage.estimated_duration_minutes ?? 60;
        
        console.log(`\n📅 Scheduling ${stageName} (${pathName} path, order ${stage.stage_order})`);
        console.log(`⏱️ Duration: ${minutes} minutes`);
        
        // Get current queue end time for this stage
        const stageQueueEndTime = await getStageQueueEndTime(stageId);
        console.log(`🕐 Stage queue ends at: ${stageQueueEndTime.toISOString()}`);
        console.log(`🕐 Path workflow time: ${pathCurrentTime.toISOString()}`);
        
        // WORKFLOW-FIRST LOGIC: Start time is the later of workflow sequence OR stage queue
        let actualStartTime = new Date(Math.max(pathCurrentTime.getTime(), stageQueueEndTime.getTime()));
        console.log(`🚀 Calculated start time: ${actualStartTime.toISOString()}`);
        
        // Handle expedited jobs (skip queue but respect workflow)
        if (expedited && stage.stage_order > 1) {
          actualStartTime = pathCurrentTime;
          console.log(`⚡ EXPEDITED: Using workflow time: ${actualStartTime.toISOString()}`);
        }

        // Ensure start time is within working hours
        actualStartTime = await nextWorkingStart(actualStartTime);
        console.log(`🕰️ Working hours adjusted: ${actualStartTime.toISOString()}`);
        
        // Calculate end time with proper working hours handling
        const actualEndTime = await addWorkingMinutes(actualStartTime, minutes);
        console.log(`🏁 Final schedule: ${actualStartTime.toISOString()} → ${actualEndTime.toISOString()}`);

        // STEP 5: COMPREHENSIVE WORKFLOW VALIDATION
        const startDay = toDateOnly(actualStartTime);
        const endDay = toDateOnly(actualEndTime);
        if (startDay !== endDay) {
          throw new Error(`Path ${pathName} stage ${stageName} spans overnight: ${startDay} to ${endDay}`);
        }

        // Update stage instance in database
        const { error: updateErr } = await supabase
          .from("job_stage_instances")
          .update({
            scheduled_start_at: actualStartTime.toISOString(),
            scheduled_end_at: actualEndTime.toISOString(),
            scheduled_minutes: minutes,
            schedule_status: "scheduled",
            job_order_in_stage: expedited ? 0 : null
          })
          .eq("id", stage.id);

        if (updateErr) {
          console.error(`❌ Failed updating stage ${stageName}:`, updateErr);
          continue;
        }

        // STEP 4: IMPLEMENT ATOMIC QUEUE UPDATES
        await updateStageQueueEndTime(stageId, actualEndTime);
        console.log(`✅ Updated queue end time for ${stageName} to ${actualEndTime.toISOString()}`);

        // Track scheduled stage
        scheduleResults.push({ 
          stage_instance_id: stage.id, 
          start: actualStartTime.toISOString(), 
          end: actualEndTime.toISOString(), 
          minutes 
        });
        
        // ENFORCE WORKFLOW SEQUENCE: Next stage in this path waits for this one
        pathCurrentTime = new Date(actualEndTime);
        console.log(`🔄 Path pointer updated: Next stage waits until ${pathCurrentTime.toISOString()}`);
      }
      
      // Store completion time for this workflow path
      pathCompletionTimes[pathName] = pathCurrentTime;
      console.log(`✅ Workflow path '${pathName}' completes at: ${pathCurrentTime.toISOString()}`);
    }

    // STEP 3: HANDLE CONVERGENCE POINTS
    if (convergenceStages.length > 0) {
      console.log(`\n🔗 === PROCESSING CONVERGENCE STAGES ===`);
      
      // Find the latest completion time from all parallel paths
      const latestPathCompletion = Object.values(pathCompletionTimes).reduce((latest, current) => 
        current > latest ? current : latest, new Date()
      );
      
      console.log(`⏰ All parallel paths converge at: ${latestPathCompletion.toISOString()}`);
      
      // Sort convergence stages by stage_order
      convergenceStages.sort((a, b) => a.stage_order - b.stage_order);
      
      let convergenceCurrentTime = latestPathCompletion;
      
      for (const stage of convergenceStages) {
        const stageId = stage.production_stage_id;
        const stageName = stage.production_stages?.name || 'Unknown';
        const minutes = stage.estimated_duration_minutes ?? 60;
        
        console.log(`\n📅 Scheduling convergence stage: ${stageName} (order ${stage.stage_order})`);
        
        // Get current queue end time for this stage
        const stageQueueEndTime = await getStageQueueEndTime(stageId);
        console.log(`🕐 Stage queue ends at: ${stageQueueEndTime.toISOString()}`);
        console.log(`🕐 Convergence time: ${convergenceCurrentTime.toISOString()}`);
        
        // Start time is the later of: convergence time OR stage queue time
        let actualStartTime = new Date(Math.max(convergenceCurrentTime.getTime(), stageQueueEndTime.getTime()));
        console.log(`🚀 Calculated start time: ${actualStartTime.toISOString()}`);
        
        // Handle expedited jobs
        if (expedited) {
          actualStartTime = convergenceCurrentTime;
          console.log(`⚡ EXPEDITED: Using convergence time: ${actualStartTime.toISOString()}`);
        }

        // Ensure start time is within working hours
        actualStartTime = await nextWorkingStart(actualStartTime);
        console.log(`🕰️ Working hours adjusted: ${actualStartTime.toISOString()}`);
        
        // Calculate end time with proper working hours handling
        const actualEndTime = await addWorkingMinutes(actualStartTime, minutes);
        console.log(`🏁 Final schedule: ${actualStartTime.toISOString()} → ${actualEndTime.toISOString()}`);

        // Update stage instance in database
        const { error: updateErr } = await supabase
          .from("job_stage_instances")
          .update({
            scheduled_start_at: actualStartTime.toISOString(),
            scheduled_end_at: actualEndTime.toISOString(),
            scheduled_minutes: minutes,
            schedule_status: "scheduled",
            job_order_in_stage: expedited ? 0 : null
          })
          .eq("id", stage.id);

        if (updateErr) {
          console.error(`❌ Failed updating convergence stage ${stageName}:`, updateErr);
          continue;
        }

        // Update stage queue end time atomically
        await updateStageQueueEndTime(stageId, actualEndTime);
        console.log(`✅ Updated queue end time for ${stageName} to ${actualEndTime.toISOString()}`);

        // Track scheduled stage
        scheduleResults.push({ 
          stage_instance_id: stage.id, 
          start: actualStartTime.toISOString(), 
          end: actualEndTime.toISOString(), 
          minutes 
        });

        // Update convergence time for next convergence stage
        convergenceCurrentTime = new Date(actualEndTime);
      }
    }

    // Update job completion and due dates
    if (scheduleResults.length > 0) {
      const finalCompletionDate = new Date(Math.max(
        ...scheduleResults.map(s => new Date(s.end).getTime())
      ));
      
      const internalCompletionDate = toDateOnly(finalCompletionDate);
      const dueDate = await computeDueDateFromCompletion(finalCompletionDate);

      console.log(`📅 Final job completion: ${finalCompletionDate.toISOString()}`);
      console.log(`📅 Computed due date: ${dueDate}`);

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
        console.error("❌ Failed updating job dates", jobUpdateErr);
      } else {
        console.log("✅ Updated job completion and due dates");
      }
    }

    // STEP 5: FINAL VALIDATION AND LOGGING
    console.log(`\n✅ === PARALLEL-AWARE SCHEDULING COMPLETE ===`);
    console.log(`📊 Total stages scheduled: ${scheduleResults.length}`);
    console.log(`🛤️ Workflow paths processed: ${Object.keys(workflowPaths).length}`);
    console.log(`🔗 Convergence stages processed: ${convergenceStages.length}`);
    console.log(`⚡ Job expedited: ${expedited}`);

    return new Response(JSON.stringify({ ok: true, scheduled: scheduleResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("❌ [PARALLEL-AWARE SCHEDULING] Error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});