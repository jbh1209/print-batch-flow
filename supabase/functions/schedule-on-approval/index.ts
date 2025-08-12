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
  job_table_name?: string;
}

interface WorkingHoursConfig {
  work_start_hour: number;
  work_end_hour: number;
  work_end_minute: number;
  busy_period_active: boolean;
  busy_start_hour: number;
  busy_end_hour: number;
  busy_end_minute: number;
}

interface StageInstance {
  id: UUID;
  production_stage_id: UUID;
  stage_order: number;
  status: string;
  estimated_duration_minutes: number | null;
  part_assignment: string | null;
  dependency_group: UUID | null;
  production_stages: {
    id: UUID;
    name: string;
    supports_parts: boolean;
  };
}

interface JobSplit {
  stage_id: UUID;
  date: string;
  start_time: Date;
  end_time: Date;
  minutes: number;
  split_sequence: number;
  total_splits: number;
  remaining_minutes: number;
  is_continuation: boolean;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://kgizusgqexmlfcqfjopk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SERVICE_ROLE_KEY) {
  console.warn("SERVICE_ROLE_KEY not set - updates may fail due to RLS");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "");

// ============= PHASE 1: WORKING HOURS CONFIGURATION SYSTEM =============

async function getWorkingHoursConfig(): Promise<WorkingHoursConfig> {
  const { data, error } = await supabase.rpc('get_working_hours_config');
  
  if (error || !data || data.length === 0) {
    console.warn("Failed to get working hours config, using defaults:", error);
    return {
      work_start_hour: 8,
      work_end_hour: 16,
      work_end_minute: 30,
      busy_period_active: false,
      busy_start_hour: 8,
      busy_end_hour: 18,
      busy_end_minute: 0
    };
  }
  
  return data[0] as WorkingHoursConfig;
}

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
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !(await isHoliday(date));
}

function withTime(date: Date, hour: number, minute = 0): Date {
  const d = new Date(date);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function nextWorkingStart(from: Date): Promise<Date> {
  const config = await getWorkingHoursConfig();
  const startHour = config.busy_period_active ? config.busy_start_hour : config.work_start_hour;
  
  let d = new Date(from);
  while (!(await isWorkingDay(d))) {
    d.setUTCDate(d.getUTCDate() + 1);
    d = withTime(d, startHour, 0);
  }
  
  const workStart = withTime(d, startHour, 0);
  const workEnd = config.busy_period_active 
    ? withTime(d, config.busy_end_hour, config.busy_end_minute)
    : withTime(d, config.work_end_hour, config.work_end_minute);
    
  if (d < workStart) return workStart;
  if (d > workEnd) {
    const n = new Date(d);
    n.setUTCDate(n.getUTCDate() + 1);
    return nextWorkingStart(withTime(n, startHour, 0));
  }
  return d;
}

// ============= PHASE 2: MULTI-DAY JOB SPLITTING ENGINE =============

async function calculateDailyWorkingMinutes(): Promise<number> {
  const config = await getWorkingHoursConfig();
  
  if (config.busy_period_active) {
    const busyHours = config.busy_end_hour - config.busy_start_hour;
    const busyMinutes = config.busy_end_minute;
    return busyHours * 60 + busyMinutes;
  }
  
  const normalHours = config.work_end_hour - config.work_start_hour;
  const normalMinutes = config.work_end_minute;
  return normalHours * 60 + normalMinutes;
}

async function addWorkingMinutesWithSplitting(
  start: Date, 
  totalMinutes: number,
  stageId: UUID,
  stageInstanceId: UUID
): Promise<JobSplit[]> {
  const config = await getWorkingHoursConfig();
  const dailyCapacityMinutes = await calculateDailyWorkingMinutes();
  
  console.log(`[MULTI-DAY ENGINE] Adding ${totalMinutes} minutes from ${start.toISOString()}, daily capacity: ${dailyCapacityMinutes}`);
  
  let current = await nextWorkingStart(start);
  let remaining = totalMinutes;
  const splits: JobSplit[] = [];
  let splitSequence = 1;
  
  while (remaining > 0) {
    const currentDate = toDateOnly(current);
    
    // Get daily capacity info for this stage and date
    const { data: capacityData } = await supabase.rpc('get_or_create_daily_capacity', {
      p_stage_id: stageId,
      p_date: currentDate,
      p_capacity_minutes: dailyCapacityMinutes
    });
    
    const rawAvailable = capacityData?.[0]?.available_minutes;
    const availableToday = Math.max(0, typeof rawAvailable === 'number' ? rawAvailable : dailyCapacityMinutes);
    console.log(`[MULTI-DAY ENGINE] Date: ${currentDate}, Available: ${availableToday}, Remaining: ${remaining}`);
    
    const endHour = config.busy_period_active ? config.busy_end_hour : config.work_end_hour;
    const endMinute = config.busy_period_active ? config.busy_end_minute : config.work_end_minute;
    const dayEnd = withTime(current, endHour, endMinute);
    
    const minutesToScheduleToday = Math.max(0, Math.min(remaining, availableToday));

    if (minutesToScheduleToday <= 0 || current >= dayEnd) {
      // No capacity left today or we are past end of day: move to next working day
      const nextDay = new Date(current);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      current = await nextWorkingStart(nextDay);
      continue;
    }
    
    const endTime = new Date(current.getTime() + minutesToScheduleToday * 60000);
    
    // Ensure we don't exceed working hours
    const actualEndTime = endTime > dayEnd ? dayEnd : endTime;
    const actualMinutesToday = Math.max(0, Math.floor((actualEndTime.getTime() - current.getTime()) / 60000));

    if (actualMinutesToday <= 0) {
      // Safety: advance to next working day
      const nextDay = new Date(current);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      current = await nextWorkingStart(nextDay);
      continue;
    }
    
    console.log(`[MULTI-DAY ENGINE] Split ${splitSequence}: ${current.toISOString()} → ${actualEndTime.toISOString()} (${actualMinutesToday} min)`);
    
    splits.push({
      stage_id: stageId,
      date: currentDate,
      start_time: new Date(current),
      end_time: new Date(actualEndTime),
      minutes: actualMinutesToday,
      split_sequence: splitSequence,
      total_splits: 0, // Will be set after all splits calculated
      remaining_minutes: remaining - actualMinutesToday,
      is_continuation: splitSequence > 1
    });
    
    // Update daily capacity
    await supabase.rpc('update_daily_capacity_after_scheduling', {
      p_stage_id: stageId,
      p_date: currentDate,
      p_additional_minutes: actualMinutesToday
    });
    
    remaining -= actualMinutesToday;
    splitSequence++;
    
    if (remaining > 0) {
      // Move to next working day
      const nextDay = new Date(current);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      current = await nextWorkingStart(nextDay);
    }
  }
  
  // Update total_splits for all splits
  splits.forEach(split => split.total_splits = splits.length);
  
  console.log(`[MULTI-DAY ENGINE] Job split into ${splits.length} parts across ${splits.length} days`);
  return splits;
}

// ============= PHASE 3: WORKFLOW-FIRST DEPENDENCY PROCESSOR =============

function analyzeWorkflowStructure(stages: StageInstance[]): {
  parallelPaths: Record<string, StageInstance[]>;
  convergenceStages: StageInstance[];
} {
  const parallelPaths: Record<string, StageInstance[]> = {};
  const convergenceStages: StageInstance[] = [];
  
  console.log(`[WORKFLOW ANALYZER] Analyzing ${stages.length} stages`);
  
  for (const stage of stages) {
    const partAssignment = stage.part_assignment || 'main';
    const stageName = stage.production_stages.name;
    
    console.log(`[WORKFLOW ANALYZER] Stage: ${stageName} (order ${stage.stage_order}, part: ${partAssignment})`);
    
    if (partAssignment === 'both') {
      convergenceStages.push(stage);
      console.log(`[WORKFLOW ANALYZER] → Added to convergence stages`);
    } else {
      if (!parallelPaths[partAssignment]) {
        parallelPaths[partAssignment] = [];
      }
      parallelPaths[partAssignment].push(stage);
      console.log(`[WORKFLOW ANALYZER] → Added to parallel path '${partAssignment}'`);
    }
  }
  
  // Sort each path by stage_order
  Object.values(parallelPaths).forEach(path => {
    path.sort((a, b) => a.stage_order - b.stage_order);
  });
  
  // Sort convergence stages by stage_order
  convergenceStages.sort((a, b) => a.stage_order - b.stage_order);
  
  console.log(`[WORKFLOW ANALYZER] Result: ${Object.keys(parallelPaths).length} parallel paths, ${convergenceStages.length} convergence stages`);
  
  return { parallelPaths, convergenceStages };
}

async function processParallelWorkflowPath(
  pathName: string,
  pathStages: StageInstance[],
  expedited: boolean
): Promise<{ pathCompletionTime: Date; scheduleResults: any[] }> {
  console.log(`\n[PARALLEL PROCESSOR] === PROCESSING PATH: ${pathName.toUpperCase()} ===`);
  
  let pathCurrentTime = await nextWorkingStart(new Date());
  const scheduleResults: any[] = [];
  
  for (const stage of pathStages) {
    const stageId = stage.production_stage_id;
    const stageName = stage.production_stages.name;
    const minutes = stage.estimated_duration_minutes ?? 60;
    
    console.log(`[PARALLEL PROCESSOR] Scheduling ${stageName} (${minutes} min)`);
    
    // Get stage queue end time (existing capacity-aware system)
    const { data: queueData } = await supabase.rpc('get_stage_queue_end_time', {
      p_stage_id: stageId,
      p_date: toDateOnly(new Date())
    });
    
    const stageQueueEndTime = queueData ? new Date(queueData) : await nextWorkingStart(new Date());
    console.log(`[PARALLEL PROCESSOR] Stage queue ends at: ${stageQueueEndTime.toISOString()}`);
    console.log(`[PARALLEL PROCESSOR] Path workflow time: ${pathCurrentTime.toISOString()}`);
    
    // WORKFLOW-FIRST: Start time is the later of workflow sequence OR stage queue
    let actualStartTime = new Date(Math.max(pathCurrentTime.getTime(), stageQueueEndTime.getTime()));
    
    if (expedited) {
      actualStartTime = pathCurrentTime;
      console.log(`[PARALLEL PROCESSOR] EXPEDITED: Using workflow time`);
    }
    
    actualStartTime = await nextWorkingStart(actualStartTime);
    
    // Calculate job splits across multiple days
    const jobSplits = await addWorkingMinutesWithSplitting(
      actualStartTime,
      minutes,
      stageId,
      stage.id
    );
    
    // Update master stage instance with split metadata (no continuation instances)
    if (jobSplits.length > 0) {
      const firstSplit = jobSplits[0];
      const finalSplitLocal = jobSplits[jobSplits.length - 1];
      const totalMinutesScheduled = jobSplits.reduce((sum, s) => sum + Math.max(0, s.minutes), 0);

      // Compute FIFO queue position (append) unless expedited
      let nextOrder = 0;
      if (!expedited) {
        const { data: orderRows } = await supabase
          .from('job_stage_instances')
          .select('job_order_in_stage')
          .eq('production_stage_id', stageId)
          .not('job_order_in_stage', 'is', null)
          .order('job_order_in_stage', { ascending: false })
          .limit(1);
        nextOrder = ((orderRows?.[0]?.job_order_in_stage as number | null) ?? 0) + 1;
      }

      const splitMetadata = {
        totalSplits: jobSplits.length,
        splits: jobSplits.map(s => ({
          sequence: s.split_sequence,
          startTime: s.start_time.toISOString(),
          endTime: s.end_time.toISOString(),
          durationMinutes: s.minutes,
          remainingMinutes: s.remaining_minutes
        })),
        createdAt: new Date().toISOString(),
        spansDays: jobSplits.length
      } as const;

      await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: firstSplit.start_time.toISOString(),
          scheduled_end_at: finalSplitLocal.end_time.toISOString(),
          scheduled_minutes: totalMinutesScheduled,
          schedule_status: 'scheduled',
          split_sequence: 1,
          total_splits: jobSplits.length,
          remaining_minutes: 0,
          daily_completion_minutes: finalSplitLocal.minutes,
          split_status: jobSplits.length > 1 ? 'master_with_splits' : 'complete',
          job_order_in_stage: expedited ? 0 : nextOrder,
          split_metadata: splitMetadata
        })
        .eq('id', stage.id);

      scheduleResults.push({
        stage_instance_id: stage.id,
        start: firstSplit.start_time.toISOString(),
        end: finalSplitLocal.end_time.toISOString(),
        minutes: totalMinutesScheduled,
        split_sequence: 1,
        total_splits: jobSplits.length
      });
    }
    
    // Update stage queue end time with final completion
    if (jobSplits.length > 0) {
      const finalSplit = jobSplits[jobSplits.length - 1];
      await supabase.rpc('update_stage_queue_end_time', {
        p_stage_id: stageId,
        p_new_end_time: finalSplit.end_time.toISOString(),
        p_date: toDateOnly(finalSplit.end_time)
      });
      
      // Update path pointer for next stage (workflow dependency)
      pathCurrentTime = new Date(finalSplit.end_time);
      console.log(`[PARALLEL PROCESSOR] Path updated: Next stage waits until ${pathCurrentTime.toISOString()}`);
    }
  }
  
  console.log(`[PARALLEL PROCESSOR] Path '${pathName}' completed at: ${pathCurrentTime.toISOString()}`);
  return { pathCompletionTime: pathCurrentTime, scheduleResults };
}

async function processConvergenceStages(
  convergenceStages: StageInstance[],
  pathCompletionTimes: Record<string, Date>,
  expedited: boolean
): Promise<any[]> {
  if (convergenceStages.length === 0) return [];
  
  console.log(`\n[CONVERGENCE PROCESSOR] === PROCESSING CONVERGENCE STAGES ===`);
  
  // Find latest completion time from all parallel paths
  const latestPathCompletion = Object.values(pathCompletionTimes).reduce(
    (latest, current) => current > latest ? current : latest, 
    new Date()
  );
  
  console.log(`[CONVERGENCE PROCESSOR] All paths converge at: ${latestPathCompletion.toISOString()}`);
  
  let convergenceCurrentTime = latestPathCompletion;
  const scheduleResults: any[] = [];
  
  for (const stage of convergenceStages) {
    const stageId = stage.production_stage_id;
    const stageName = stage.production_stages.name;
    const minutes = stage.estimated_duration_minutes ?? 60;
    
    console.log(`[CONVERGENCE PROCESSOR] Scheduling ${stageName} (${minutes} min)`);
    
    const { data: queueData } = await supabase.rpc('get_stage_queue_end_time', {
      p_stage_id: stageId,
      p_date: toDateOnly(new Date())
    });
    
    const stageQueueEndTime = queueData ? new Date(queueData) : await nextWorkingStart(new Date());
    
    let actualStartTime = new Date(Math.max(convergenceCurrentTime.getTime(), stageQueueEndTime.getTime()));
    
    if (expedited) {
      actualStartTime = convergenceCurrentTime;
    }
    
    actualStartTime = await nextWorkingStart(actualStartTime);
    
    // Handle multi-day convergence stages
    const jobSplits = await addWorkingMinutesWithSplitting(
      actualStartTime,
      minutes,
      stageId,
      stage.id
    );
    
    // Update master convergence stage instance with split metadata (no continuation instances)
    if (jobSplits.length > 0) {
      const firstSplit = jobSplits[0];
      const finalSplitLocal = jobSplits[jobSplits.length - 1];
      const totalMinutesScheduled = jobSplits.reduce((sum, s) => sum + Math.max(0, s.minutes), 0);

      // Compute FIFO queue position (append) unless expedited
      let nextOrder = 0;
      if (!expedited) {
        const { data: orderRows } = await supabase
          .from('job_stage_instances')
          .select('job_order_in_stage')
          .eq('production_stage_id', stageId)
          .not('job_order_in_stage', 'is', null)
          .order('job_order_in_stage', { ascending: false })
          .limit(1);
        nextOrder = ((orderRows?.[0]?.job_order_in_stage as number | null) ?? 0) + 1;
      }

      const splitMetadata = {
        totalSplits: jobSplits.length,
        splits: jobSplits.map(s => ({
          sequence: s.split_sequence,
          startTime: s.start_time.toISOString(),
          endTime: s.end_time.toISOString(),
          durationMinutes: s.minutes,
          remainingMinutes: s.remaining_minutes
        })),
        createdAt: new Date().toISOString(),
        spansDays: jobSplits.length
      } as const;

      const { error: updateErr } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: firstSplit.start_time.toISOString(),
          scheduled_end_at: finalSplitLocal.end_time.toISOString(),
          scheduled_minutes: totalMinutesScheduled,
          schedule_status: 'scheduled',
          split_sequence: 1,
          total_splits: jobSplits.length,
          remaining_minutes: 0,
          daily_completion_minutes: finalSplitLocal.minutes,
          split_status: jobSplits.length > 1 ? 'master_with_splits' : 'complete',
          job_order_in_stage: expedited ? 0 : nextOrder,
          split_metadata: splitMetadata
        })
        .eq('id', stage.id);

      if (!updateErr) {
        scheduleResults.push({
          stage_instance_id: stage.id,
          start: firstSplit.start_time.toISOString(),
          end: finalSplitLocal.end_time.toISOString(),
          minutes: totalMinutesScheduled,
          split_sequence: 1,
          total_splits: jobSplits.length
        });
      }
    }
    
    const finalSplit = jobSplits[jobSplits.length - 1];
    if (finalSplit) {
      await supabase.rpc('update_stage_queue_end_time', {
        p_stage_id: stageId,
        p_new_end_time: finalSplit.end_time.toISOString(),
        p_date: toDateOnly(finalSplit.end_time)
      });
      
      convergenceCurrentTime = new Date(finalSplit.end_time);
    }
  }
  
  return scheduleResults;
}

// ============= MAIN SCHEDULING ORCHESTRATOR =============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SchedulingRequest;
    const jobId = body.job_id;
    const jobTable = body.job_table_name ?? "production_jobs";

    console.log("🚀 [WORKFLOW-FIRST SCHEDULER] Starting job", jobId, jobTable);

    // Fetch stages with parallel processing information
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
        job_id,
        job_table_name,
        category_id,
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
      return new Response(JSON.stringify({ error: stagesError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (!stages || stages.length === 0) {
      console.log("ℹ️ No pending stages found for job");
      return new Response(JSON.stringify({ ok: true, scheduled: [] }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { data: jobData } = await supabase
      .from("production_jobs")
      .select("is_expedited")
      .eq("id", jobId)
      .single();

    const expedited = jobData?.is_expedited ?? false;
    console.log(`📋 Found ${stages.length} stages to schedule (expedited: ${expedited})`);

    // STEP 1: Analyze workflow structure
    const { parallelPaths, convergenceStages } = analyzeWorkflowStructure(stages as StageInstance[]);

    let allScheduleResults: any[] = [];
    const pathCompletionTimes: Record<string, Date> = {};

    // STEP 2: Process parallel workflow paths
    for (const [pathName, pathStages] of Object.entries(parallelPaths)) {
      const { pathCompletionTime, scheduleResults } = await processParallelWorkflowPath(
        pathName,
        pathStages,
        expedited
      );
      pathCompletionTimes[pathName] = pathCompletionTime;
      allScheduleResults.push(...scheduleResults);
    }

    // STEP 3: Process convergence stages
    const convergenceResults = await processConvergenceStages(
      convergenceStages as StageInstance[],
      pathCompletionTimes,
      expedited
    );
    allScheduleResults.push(...convergenceResults);

    // STEP 4: Update job completion and due dates
    if (allScheduleResults.length > 0) {
      const finalCompletionDate = new Date(Math.max(
        ...allScheduleResults.map(s => new Date(s.end).getTime())
      ));
      
      const internalCompletionDate = toDateOnly(finalCompletionDate);
      const dailyCapacity = await calculateDailyWorkingMinutes();
      const bufferEnd = await addWorkingMinutesWithSplitting(finalCompletionDate, dailyCapacity, stages[0].production_stage_id, stages[0].id);
      const dueDate = toDateOnly(bufferEnd[bufferEnd.length - 1].end_time);

      console.log(`📅 Final job completion: ${finalCompletionDate.toISOString()}`);
      console.log(`📅 Computed due date: ${dueDate}`);

      const { data: jobLockData } = await supabase
        .from("production_jobs")
        .select("due_date_locked")
        .eq("id", jobId)
        .single();

      const updatePayload: Record<string, any> = {
        internal_completion_date: internalCompletionDate,
        last_due_date_check: new Date().toISOString(),
      };
      
      if (!jobLockData?.due_date_locked) {
        updatePayload.due_date = dueDate;
        updatePayload.due_date_warning_level = "green";
      }

      await supabase
        .from("production_jobs")
        .update(updatePayload)
        .eq("id", jobId);
    }

    console.log(`✅ [WORKFLOW-FIRST SCHEDULER] Successfully scheduled ${allScheduleResults.length} stage instances`);

    return new Response(JSON.stringify({ 
      ok: true, 
      scheduled: allScheduleResults 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("❌ [WORKFLOW-FIRST SCHEDULER] Error:", error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});