// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// ---- Timezone handling ------------------------------------------------------
// Africa/Johannesburg = UTC+02:00  => 120 minutes
const TZ_OFFSET_MINUTES = 120;
const MS = 60_000;
const addMin = (d, m)=>new Date(d.getTime() + m * MS);
// Build a UTC Date that will DISPLAY at the intended local clock time.
// Example: with +120 tz, mkLocal(2025-08-14, 08:00) stores 06:00Z so the UI shows 08:00.
const mkLocal = (y, m, d, hh = 0, mm = 0, ss = 0)=>new Date(Date.UTC(y, m, d, hh, mm, ss) - TZ_OFFSET_MINUTES * MS);
const parseClock = (t)=>{
  const [h, m, s = "0"] = t.split(":");
  return {
    h: +h,
    m: +m,
    s: +s
  };
};
function isHoliday(holidays, day) {
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(day.getUTCDate()).padStart(2, "0");
  // holidays come in as YYYY-MM-DD (local). Compare on date-only.
  return holidays.some((h)=>h.date.startsWith(`${y}-${m}-${d}`));
}
function dailyWindows(input, day) {
  const dow = mkLocal(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()).getDay(); // local day-of-week
  const todays = input.shifts.filter((s)=>s.day_of_week === dow && s.is_working_day);
  const wins = [];
  for (const s of todays){
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = mkLocal(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), st.h, st.m, +st.s);
    const end = mkLocal(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), et.h, et.m, +et.s);
    if (end <= start) continue;
    // Start with the full shift, then carve out breaks.
    let segs = [
      {
        start,
        end
      }
    ];
    for (const br of input.meta.breaks ?? []){
      const bt = parseClock(br.start_time);
      const b0 = mkLocal(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), bt.h, bt.m, +bt.s);
      const b1 = addMin(b0, br.minutes);
      const next = [];
      for (const g of segs){
        if (b1 <= g.start || b0 >= g.end) next.push(g);
        else {
          if (g.start < b0) next.push({
            start: g.start,
            end: b0
          });
          if (b1 < g.end) next.push({
            start: b1,
            end: g.end
          });
        }
      }
      segs = next;
    }
    wins.push(...segs);
  }
  return wins.sort((a, b)=>a.start.getTime() - b.start.getTime());
}
function* iterWindows(input, from, horizonDays = 365) {
  for(let i = 0; i < horizonDays; i++){
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()) + i * 24 * 60 * MS);
    if (isHoliday(input.holidays, d)) continue;
    for (const w of dailyWindows(input, d)){
      // Snap cursor to the window start if we're before it (removes “:49” starts)
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      if (w.end <= s) continue;
      yield {
        start: s < w.start ? w.start : s,
        end: w.end
      };
    }
  }
}
function placeDuration(input, earliest, minutes) {
  let left = Math.max(0, Math.ceil(minutes));
  const placed = [];
  // Snap the very first placement to the next window start
  let cursor = earliest;
  for (const w of iterWindows(input, cursor)){
    if (left <= 0) break;
    // Ensure we never start inside a window at a weird minute when we don't need to
    if (cursor < w.start) cursor = w.start;
    const cap = Math.floor((w.end.getTime() - Math.max(w.start.getTime(), cursor.getTime())) / MS);
    const use = Math.min(cap, left);
    if (use > 0) {
      const s = new Date(Math.max(w.start.getTime(), cursor.getTime()));
      const e = addMin(s, use);
      placed.push({
        start: s,
        end: e
      });
      left -= use;
      cursor = e; // chain on the same resource
    }
  }
  return placed;
}
function nextWorkingStart(input, from) {
  for (const w of iterWindows(input, from, 365))return w.start;
  return from;
}
function planSchedule(input, baseStart) {
  const jobs = input.jobs.filter((j)=>j.proof_approved_at).map((j)=>({
      ...j,
      approvedAt: new Date(j.proof_approved_at)
    })).sort((a, b)=>a.approvedAt.getTime() - b.approvedAt.getTime());
  const resourceFree = new Map();
  const updates = [];
  for (const job of jobs){
    const stages = [
      ...job.stages
    ].sort((a, b)=>(a.stage_order ?? 9999) - (b.stage_order ?? 9999));
    const orders = Array.from(new Set(stages.map((s)=>s.stage_order ?? 9999))).sort((a, b)=>a - b);
    const doneAt = new Map();
    for (const ord of orders){
      for (const st of stages.filter((s)=>(s.stage_order ?? 9999) === ord)){
        const resource = st.production_stage_id;
        let earliest = job.approvedAt;
        if (baseStart) earliest = new Date(Math.max(earliest.getTime(), baseStart.getTime()));
        // Respect predecessors within the job
        for (const prev of stages){
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const end = doneAt.get(prev.id);
            if (end && end > earliest) earliest = end;
          }
        }
        // Respect current resource availability
        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;
        const mins = Math.max(0, Math.round((st.estimated_minutes || 0) + (st.setup_minutes || 0)));
        const segs = mins ? placeDuration(input, earliest, mins) : [
          {
            start: earliest,
            end: earliest
          }
        ];
        const start = segs[0].start, end = segs[segs.length - 1].end;
        updates.push({
          id: st.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          minutes: mins
        });
        doneAt.set(st.id, end);
        resourceFree.set(resource, end);
      }
    }
  }
  return {
    updates
  };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(()=>({})) : {};
    const qp = (k, def)=>url.searchParams.get(k) ?? body[k] ?? def;
    const commit = qp("commit", "true") === "true";
    const proposed = qp("proposed", "true") === "true";
    const onlyIfUnset = qp("onlyIfUnset", "true") === "true";
    const nuclear = qp("nuclear", "false") === "true";
    const startFrom = qp("startFrom", ""); // YYYY-MM-DD
    const wipeAll = qp("wipeAll", "false") === "true";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    });
    // 1) Snapshot
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap;
    // 2) Nuclear base start in LOCAL date
    let baseStart;
    if (nuclear) {
      // Parse YYYY-MM-DD as local midnight (so “today” = today at 00:00 local)
      const seed = startFrom ? mkLocal(Number(startFrom.slice(0, 4)), Number(startFrom.slice(5, 7)) - 1, Number(startFrom.slice(8, 10)), 0, 0, 0) : addMin(new Date(), 24 * 60); // tomorrow
      baseStart = nextWorkingStart(input, seed);
      if (commit) {
        const { error: clearErr } = await supabase.rpc("unschedule_auto_stages", {
          from_date: baseStart.toISOString().slice(0, 10),
          wipe_all: wipeAll
        });
        if (clearErr) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(clearErr));
      }
    }
    // 3) Plan
    const { updates } = planSchedule(input, baseStart);
    // 4) Apply
    let applied = {
      updated: 0
    };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc("apply_stage_updates_safe", {
        updates,
        commit: true,
        only_if_unset: onlyIfUnset,
        as_proposed: proposed
      });
      if (error) throw new Error("apply_stage_updates_safe failed: " + JSON.stringify(error));
      applied = data;
    }
    return new Response(JSON.stringify({
      ok: true,
      scheduled: updates.length,
      applied,
      baseStart
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: String(e)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
