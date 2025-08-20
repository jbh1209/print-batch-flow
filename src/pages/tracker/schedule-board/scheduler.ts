// tracker/schedule-board/scheduler.ts
export type UUID = string;

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
  const jobs = input.jobs
    .filter(j => j.proof_approved_at)
    .map(j => ({...j, approvedAt: new Date(j.proof_approved_at as string)}))
    .sort((a,b)=> (a.approvedAt.getTime()-b.approvedAt.getTime()) || ((a.due_date?Date.parse(a.due_date):0) - (b.due_date?Date.parse(b.due_date):0)));

  const avail = new Map<UUID, Date>(); // resource -> next free time
  const updates: PlacementUpdate[] = [];

  for (const job of jobs) {
    const stages = [...job.stages].sort((a,b)=>{
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
        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const ended = endTimes.get(prev.id);
            if (ended && ended > earliest) earliest = ended;
          }
        }
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
