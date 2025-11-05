// tracker/schedule-board/scheduler.ts
export type UUID = string;

// Non-schedulable stages - these are informational only and should never be scheduled
const NON_SCHEDULABLE_STAGES = ['PROOF', 'DTP'];

function isSchedulableStage(stage: StageRow): boolean {
  return !NON_SCHEDULABLE_STAGES.some(ns => stage.stage_name.toUpperCase().includes(ns));
}

export interface SchedulerInput {
  meta: { generated_at: string; printing_stage_ids?: UUID[]; breaks?: { start_time: string; minutes: number }[] };
  shifts: { id: UUID; day_of_week: number; shift_start_time: string; shift_end_time: string; is_working_day: boolean; is_active: boolean; created_at: string; updated_at: string; }[];
  holidays: { date: string; name: string }[];
  routes: { category_id: UUID; production_stage_id: UUID; stage_order: number }[];
  jobs: JobRow[];
}

export interface JobRow {
  job_id: UUID;
  wo_number: string;
  customer_name: string;
  quantity: number;
  due_date: string | null;
  proof_approved_at: string | null;
  estimated_run_minutes: number;
  stages: StageRow[];
}

export interface StageRow {
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

export interface PlacementUpdate { id: UUID; start_at: string; end_at: string; minutes: number; }
export interface ScheduleResult { updates: PlacementUpdate[]; }

const MS_PER_MIN = 60000;

function parseClock(t: string){ const [h,m,s='0'] = t.split(':'); return {h:+h,m:+m,s:+s}; }
function startOfDayLocal(d: Date){ return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0); }
function addMinutes(d: Date, mins: number){ return new Date(d.getTime() + mins*MS_PER_MIN); }
function fmt(dt: Date){ return new Date(dt.getTime() - dt.getMilliseconds()).toISOString(); }
type Interval = { start: Date; end: Date };

function isHoliday(holidays: SchedulerInput['holidays'], day: Date): boolean {
  const y=day.getFullYear(), m=String(day.getMonth()+1).padStart(2,'0'), d=String(day.getDate()).padStart(2,'0');
  const key = `${y}-${m}-${d}`;
  return holidays.some(h => h.date.startsWith(key));
}

function buildDailyWindows(shifts: SchedulerInput['shifts'], breaks: NonNullable<SchedulerInput['meta']['breaks']>|undefined, day: Date): Interval[] {
  const dow = day.getDay();
  const todays = shifts.filter(s => s.day_of_week===dow && s.is_working_day);
  const windows: Interval[] = [];
  for (const s of todays) {
    const st=parseClock(s.shift_start_time), et=parseClock(s.shift_end_time);
    const start=new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, st.s as any);
    const end  =new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, et.s as any);
    if (end<=start) continue;
    let segs: Interval[] = [{start, end}];
    if (breaks) {
      for (const br of breaks) {
        const bt=parseClock(br.start_time);
        const bstart=new Date(day.getFullYear(), day.getMonth(), day.getDate(), bt.h, bt.m, bt.s as any);
        const bend=addMinutes(bstart, br.minutes);
        const next: Interval[] = [];
        for (const seg of segs) {
          if (bend<=seg.start || bstart>=seg.end) next.push(seg);
          else {
            if (seg.start<bstart) next.push({start: seg.start, end: bstart});
            if (bend<seg.end)     next.push({start: bend, end: seg.end});
          }
        }
        segs = next;
      }
    }
    windows.push(...segs);
  }
  return windows.sort((a,b)=>a.start.getTime()-b.start.getTime());
}

function* iterateWorkingWindows(input: SchedulerInput, from: Date, horizonDays=60): Generator<Interval> {
  const br = input.meta.breaks;
  for (let i=0;i<horizonDays;i++){
    const day = addMinutes(startOfDayLocal(from), i*24*60);
    if (isHoliday(input.holidays, day)) continue;
    const wins = buildDailyWindows(input.shifts, br, day);
    for (const w of wins) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function placeDuration(input: SchedulerInput, earliest: Date, minutes: number, horizon=60): Interval[] {
  let remain = Math.max(0, Math.ceil(minutes));
  const placed: Interval[] = [];
  let cursor = new Date(earliest);
  const it = iterateWorkingWindows(input, cursor, horizon);
  for (const win of it){
    if (remain<=0) break;
    const s = new Date(Math.max(win.start.getTime(), cursor.getTime()));
    if (s >= win.end) continue;
    const cap = Math.floor((win.end.getTime() - s.getTime())/MS_PER_MIN);
    const use = Math.min(cap, remain);
    const e = addMinutes(s, use);
    placed.push({start: s, end: e});
    remain -= use;
    cursor = e;
  }
  if (remain>0) return placed.concat(placeDuration(input, cursor, remain, horizon+30));
  return placed;
}

export function planSchedule(input: SchedulerInput): ScheduleResult {
  // FIXED: Strict FIFO ordering - sort ONLY by proof_approved_at timestamp
  const jobs = input.jobs
    .filter(j => j.proof_approved_at)
    .map(j => ({...j, approvedAt: new Date(j.proof_approved_at as string)}))
    .sort((a,b)=> a.approvedAt.getTime() - b.approvedAt.getTime()); // REMOVED secondary due_date sort

  const avail = new Map<UUID, Date>(); // resource -> next free time
  const updates: PlacementUpdate[] = [];

  for (const job of jobs) {
    // Filter out PROOF and DTP stages - they should never be scheduled
    const schedulableStages = job.stages.filter(isSchedulableStage);
    
    const stages = [...schedulableStages].sort((a,b)=>{
      const ao=a.stage_order ?? 9999, bo=b.stage_order ?? 9999;
      if (ao!==bo) return ao-bo; return 0;
    });

    const orders = Array.from(new Set(stages.map(s => s.stage_order ?? 9999))).sort((a,b)=>a-b);
    const endTimes = new Map<UUID, Date>();

    for (const ord of orders) {
      const layer = stages.filter(s => (s.stage_order ?? 9999) === ord);
      for (const st of layer) {
        const resource = st.production_stage_id;
        let earliest = job.approvedAt;
        
        // CRITICAL: Part-assignment dependency logic matches advance_parallel_job_stage
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
          // This MUST match the exact logic from advance_parallel_job_stage function
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
          
          // Rule 4: Skip this predecessor if it's NOT a logical dependency AND no explicit sync
          // Example: Cover UV should NOT wait for Text T250 (different parts, no dependency_group)
          if (!isLogicalDependency && !sameDependencyGroup) {
            continue; // This predecessor does not block the current stage
          }
          
          // Apply the dependency: current stage must wait for previous stage to finish
          const ended = endTimes.get(prev.id);
          if (ended && ended > earliest) earliest = ended;
        }
        
        // FIXED: Enforce FIFO - resource must wait until this job's turn
        // Only use resource availability if it's AFTER this job's earliest possible start
        const resAvail = avail.get(resource);
        if (resAvail && resAvail > earliest) earliest = resAvail;

        const mins = Math.max(0, Math.round((st.estimated_minutes||0) + (st.setup_minutes||0)));
        const segments = mins>0 ? placeDuration(input, earliest, mins) : [{start: earliest, end: earliest}];
        const start = segments[0].start, end = segments[segments.length-1].end;
        updates.push({ id: st.id, start_at: start.toISOString(), end_at: end.toISOString(), minutes: mins });
        endTimes.set(st.id, end);
        avail.set(resource, end);
      }
    }
  }
  return { updates };
}
