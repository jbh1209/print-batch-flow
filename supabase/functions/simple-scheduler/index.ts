// Simple scheduler - implements October 24 parallel execution logic
// Cover and Text stages run in PARALLEL except at explicit sync points
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= TYPES =============
type UUID = string;

interface SchedulerInput {
  meta: { 
    generated_at: string; 
    printing_stage_ids?: UUID[]; 
    breaks?: { start_time: string; minutes: number }[] 
  };
  shifts: { 
    id: UUID; 
    day_of_week: number; 
    shift_start_time: string; 
    shift_end_time: string; 
    is_working_day: boolean; 
    is_active: boolean; 
    created_at: string; 
    updated_at: string; 
  }[];
  holidays: { date: string; name: string }[];
  routes: { category_id: UUID; production_stage_id: UUID; stage_order: number }[];
  jobs: JobRow[];
}

interface JobRow {
  job_id: UUID;
  wo_number: string;
  customer_name: string;
  quantity: number;
  due_date: string | null;
  proof_approved_at: string | null;
  estimated_run_minutes: number;
  stages: StageRow[];
}

interface StageRow {
  id: UUID;
  job_id: UUID;
  status: string;
  quantity: number | null;
  job_table: string;
  part_name: string | null;
  part_type: string | null;
  stage_name: string;
  stage_group_id: UUID | null;
  stage_group_name: string | null;
  category_id: UUID | null;
  stage_order: number | null;
  setup_minutes: number;
  estimated_minutes: number;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  schedule_status: string | null;
  previous_stage_id: UUID | null;
  dependency_group: string | null;
  part_assignment: string | null;
  production_stage_id: UUID;
}

interface PlacementUpdate { 
  id: UUID; 
  start_at: string; 
  end_at: string; 
  minutes: number; 
}

interface DebugDependency {
  prev_id: UUID;
  prev_name: string;
  prev_part: string | null;
  prev_order: number | null;
  matched: boolean;
  reason: string;
}

interface DebugRecord {
  job_id: UUID;
  wo_no: string;
  stage_id: UUID;
  stage_name: string;
  part_assignment: string | null;
  dependency_group: string | null;
  stage_order: number | null;
  deps_considered: DebugDependency[];
  earliest_from_dependencies: string;
  resource_id: UUID;
  chosen_segments: { start: string; end: string }[];
  total_minutes: number;
}

type Interval = { start: Date; end: Date };

// ============= CONSTANTS =============
const NON_SCHEDULABLE_STAGES = ['PROOF', 'DTP'];
const MS_PER_MIN = 60000;

// ============= HELPER FUNCTIONS =============
function isSchedulableStage(stage: StageRow): boolean {
  return !NON_SCHEDULABLE_STAGES.some(ns => stage.stage_name.toUpperCase().includes(ns));
}

function parseClock(t: string) { 
  const [h, m, s = '0'] = t.split(':'); 
  return { h: +h, m: +m, s: +s }; 
}

function startOfDayLocal(d: Date) { 
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); 
}

function addMinutes(d: Date, mins: number) { 
  return new Date(d.getTime() + mins * MS_PER_MIN); 
}

function fmt(dt: Date) { 
  return new Date(dt.getTime() - dt.getMilliseconds()).toISOString(); 
}

function isHoliday(holidays: SchedulerInput['holidays'], day: Date): boolean {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  const key = `${y}-${m}-${d}`;
  return holidays.some(h => h.date.startsWith(key));
}

function buildDailyWindows(
  shifts: SchedulerInput['shifts'], 
  breaks: NonNullable<SchedulerInput['meta']['breaks']> | undefined, 
  day: Date
): Interval[] {
  const dow = day.getDay();
  const todays = shifts.filter(s => s.day_of_week === dow && s.is_working_day);
  const windows: Interval[] = [];
  
  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, st.s);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, et.s);
    
    if (end <= start) continue;
    
    let segs: Interval[] = [{ start, end }];
    
    if (breaks) {
      for (const br of breaks) {
        const bt = parseClock(br.start_time);
        const bstart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), bt.h, bt.m, bt.s);
        const bend = addMinutes(bstart, br.minutes);
        const next: Interval[] = [];
        
        for (const seg of segs) {
          if (bend <= seg.start || bstart >= seg.end) {
            next.push(seg);
          } else {
            if (seg.start < bstart) next.push({ start: seg.start, end: bstart });
            if (bend < seg.end) next.push({ start: bend, end: seg.end });
          }
        }
        segs = next;
      }
    }
    windows.push(...segs);
  }
  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function* iterateWorkingWindows(
  input: SchedulerInput, 
  from: Date, 
  horizonDays = 60
): Generator<Interval> {
  const br = input.meta.breaks;
  for (let i = 0; i < horizonDays; i++) {
    const day = addMinutes(startOfDayLocal(from), i * 24 * 60);
    if (isHoliday(input.holidays, day)) continue;
    
    const wins = buildDailyWindows(input.shifts, br, day);
    for (const w of wins) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function placeDuration(
  input: SchedulerInput, 
  earliest: Date, 
  minutes: number, 
  horizon = 60
): Interval[] {
  let remain = Math.max(0, Math.ceil(minutes));
  const placed: Interval[] = [];
  let cursor = new Date(earliest);
  const it = iterateWorkingWindows(input, cursor, horizon);
  
  for (const win of it) {
    if (remain <= 0) break;
    const s = new Date(Math.max(win.start.getTime(), cursor.getTime()));
    if (s >= win.end) continue;
    
    const cap = Math.floor((win.end.getTime() - s.getTime()) / MS_PER_MIN);
    const use = Math.min(cap, remain);
    const e = addMinutes(s, use);
    placed.push({ start: s, end: e });
    remain -= use;
    cursor = e;
  }
  
  if (remain > 0) {
    return placed.concat(placeDuration(input, cursor, remain, horizon + 30));
  }
  return placed;
}

// ============= CORE SCHEDULER LOGIC =============
function planSchedule(
  input: SchedulerInput,
  options: {
    onlyJobIds?: UUID[];
    baseStart?: Date;
    debug?: boolean;
  } = {}
): { updates: PlacementUpdate[]; debugRecords: DebugRecord[] } {
  const { onlyJobIds, baseStart, debug = false } = options;
  
  // Filter jobs if onlyJobIds specified
  let jobsToSchedule = input.jobs
    .filter(j => j.proof_approved_at)
    .map(j => ({ ...j, approvedAt: new Date(j.proof_approved_at as string) }));
  
  if (onlyJobIds && onlyJobIds.length > 0) {
    jobsToSchedule = jobsToSchedule.filter(j => onlyJobIds.includes(j.job_id));
  }
  
  // CRITICAL: Sort ONLY by proof_approved_at timestamp (FIFO)
  jobsToSchedule.sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());
  
  const updates: PlacementUpdate[] = [];
  const debugRecords: DebugRecord[] = [];
  
  for (const job of jobsToSchedule) {
    // Filter out PROOF and DTP stages - they should never be scheduled
    const schedulableStages = job.stages.filter(isSchedulableStage);
    
    const stages = [...schedulableStages].sort((a, b) => {
      const ao = a.stage_order ?? 9999;
      const bo = b.stage_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return 0;
    });
    
    const orders = Array.from(new Set(stages.map(s => s.stage_order ?? 9999))).sort((a, b) => a - b);
    const endTimes = new Map<UUID, Date>();
    
    for (const ord of orders) {
      const layer = stages.filter(s => (s.stage_order ?? 9999) === ord);
      
      for (const st of layer) {
        const resource = st.production_stage_id;
        let earliest = baseStart || job.approvedAt;
        
        const debugDeps: DebugDependency[] = [];
        
        // CRITICAL: October 24 part-assignment dependency logic
        // Cover and Text stages run in PARALLEL unless explicitly synchronized
        for (const prev of stages) {
          const prevOrder = prev.stage_order ?? 9999;
          const currOrder = st.stage_order ?? 9999;
          
          // Rule 1: Previous stage must be earlier in workflow order
          if (prevOrder >= currOrder) continue;
          
          // Normalize part assignments to lowercase for comparison
          const currPart = st.part_assignment?.toLowerCase() ?? null;
          const prevPart = prev.part_assignment?.toLowerCase() ?? null;
          
          // Rule 2: Determine if previous stage is a LOGICAL dependency
          // This MUST match the exact logic from October 24 advance_parallel_job_stage
          const isLogicalDependency =
            // Case A: Previous stage is 'both' → it feeds ALL downstream paths
            (prevPart === 'both') ||
            
            // Case B: Current stage is 'both' → it waits for ALL upstream paths (cover/text/null)
            (currPart === 'both' && (prevPart === null || prevPart === 'cover' || prevPart === 'text')) ||
            
            // Case C: Both stages are on the SAME specific part (cover→cover or text→text)
            (currPart !== null && currPart !== 'both' && prevPart === currPart) ||
            
            // Case D: Either has no part assignment → single-part job, all stages chain
            (currPart === null || prevPart === null);
          
          // Rule 3: Explicit synchronization via dependency_group overrides part logic
          const sameDependencyGroup = 
            !!st.dependency_group && 
            !!prev.dependency_group &&
            st.dependency_group === prev.dependency_group;
          
          let reason = '';
          let matched = false;
          
          if (isLogicalDependency || sameDependencyGroup) {
            matched = true;
            if (sameDependencyGroup) {
              reason = 'same_dependency_group';
            } else if (prevPart === 'both') {
              reason = 'prev_both_feeds_all';
            } else if (currPart === 'both') {
              reason = 'curr_both_waits_all';
            } else if (currPart === prevPart) {
              reason = 'same_part_path';
            } else if (currPart === null || prevPart === null) {
              reason = 'single_part_chain';
            }
            
            // Apply the dependency: current stage must wait for previous stage to finish
            const ended = endTimes.get(prev.id);
            if (ended && ended > earliest) {
              earliest = ended;
            }
          } else {
            reason = 'skipped_different_part';
          }
          
          if (debug) {
            debugDeps.push({
              prev_id: prev.id,
              prev_name: prev.stage_name,
              prev_part: prevPart,
              prev_order: prevOrder,
              matched,
              reason
            });
          }
        }
        
        const mins = Math.max(0, Math.round((st.estimated_minutes || 0) + (st.setup_minutes || 0)));
        const segments = mins > 0 ? placeDuration(input, earliest, mins) : [{ start: earliest, end: earliest }];
        const start = segments[0].start;
        const end = segments[segments.length - 1].end;
        
        updates.push({ 
          id: st.id, 
          start_at: start.toISOString(), 
          end_at: end.toISOString(), 
          minutes: mins 
        });
        
        endTimes.set(st.id, end);
        
        if (debug) {
          debugRecords.push({
            job_id: job.job_id,
            wo_no: job.wo_number,
            stage_id: st.id,
            stage_name: st.stage_name,
            part_assignment: st.part_assignment,
            dependency_group: st.dependency_group,
            stage_order: st.stage_order,
            deps_considered: debugDeps,
            earliest_from_dependencies: earliest.toISOString(),
            resource_id: resource,
            chosen_segments: segments.map(seg => ({ 
              start: seg.start.toISOString(), 
              end: seg.end.toISOString() 
            })),
            total_minutes: mins
          });
        }
      }
    }
  }
  
  return { updates, debugRecords };
}

// ============= EDGE FUNCTION HANDLER =============
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const sb = createClient(supabaseUrl, serviceKey);
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const commit = body.commit !== false; // default true
    const proposed = body.proposed === true; // default false
    const onlyIfUnset = body.onlyIfUnset !== false; // default true
    const onlyJobIds = body.onlyJobIds || body.jobIds || null;
    const baseStart = body.baseStart ? new Date(body.baseStart) : null;
    const debug = body.debug === true; // default false
    const woNo = body.woNo || null; // Work order number filter
    
    console.log('Scheduler invoked:', { 
      commit, 
      proposed, 
      onlyIfUnset, 
      onlyJobIds, 
      baseStart: baseStart?.toISOString(), 
      debug,
      woNo
    });
    
    // Fetch scheduler input data
    const { data: snap, error: exportErr } = await sb.rpc('export_scheduler_input');
    if (exportErr) {
      console.error('export_scheduler_input failed:', exportErr);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to fetch scheduler input',
          details: exportErr
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const input = snap as SchedulerInput;
    
    // Filter by work order number if specified
    let jobIdsToSchedule = onlyJobIds;
    if (woNo && !jobIdsToSchedule) {
      const matchingJobs = input.jobs.filter(j => j.wo_number === woNo);
      if (matchingJobs.length > 0) {
        jobIdsToSchedule = matchingJobs.map(j => j.job_id);
        console.log(`Filtered to WO ${woNo}: ${jobIdsToSchedule.length} job(s)`);
      }
    }
    
    // Run scheduler
    const { updates, debugRecords } = planSchedule(input, {
      onlyJobIds: jobIdsToSchedule,
      baseStart: baseStart || undefined,
      debug
    });
    
    // Filter out any PROOF/DTP updates that may have slipped through
    const schedulableUpdates = updates.filter(u => {
      const stageInstance = input.jobs
        .flatMap(j => j.stages)
        .find(s => s.id === u.id);
      return stageInstance && !NON_SCHEDULABLE_STAGES.some(ns => 
        stageInstance.stage_name.toUpperCase().includes(ns)
      );
    });
    
    console.log(`Scheduler produced ${schedulableUpdates.length} updates`);
    
    let applied: any = { updated: 0 };
    
    if (commit && schedulableUpdates.length > 0) {
      const { data, error } = await sb.rpc('apply_stage_updates_safe', {
        updates: schedulableUpdates,
        commit: true,
        only_if_unset: onlyIfUnset,
        as_proposed: proposed
      });
      
      if (error) {
        console.error('apply_stage_updates_safe failed:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to apply updates',
            details: error,
            updates: schedulableUpdates
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      applied = data;
      console.log('Applied updates:', applied);
    }
    
    // Get validation results
    const { data: validationData } = await sb.rpc('validate_job_scheduling_precedence');
    const violations = validationData || [];
    
    const response = {
      success: true,
      wrote_slots: schedulableUpdates.length,
      updated_jsi: applied.updated || 0,
      violations,
      scheduled: schedulableUpdates.length,
      applied,
      debug: debug ? debugRecords : undefined
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Unhandled error in edge function', 
        message: err instanceof Error ? err.message : String(err) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
