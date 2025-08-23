// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- CORS -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* -------------------- time helpers -------------------- */
const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const asBool = (v: unknown, def: boolean) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
};
const parseClock = (t: string) => {
  const [h, m, s = "0"] = t.split(":");
  return { h: +h, m: +m, s: +s };
};

/* -------------------- calendar helpers -------------------- */
type Shift = {
  day_of_week: number; // 0..6 (Sun..Sat)
  is_working_day: boolean;
  shift_start_time: string; // "08:00:00"
  shift_end_time: string; // "16:30:00"
};

type Holiday = { date: string }; // 'YYYY-MM-DD...'

type ExportInput = {
  meta: {
    breaks?: { start_time: string; minutes: number }[];
  };
  shifts: Shift[];
  holidays: Holiday[];
  jobs: Array<{
    id: string;
    proof_approved_at: string | null;
    stages: Array<{
      id: string;
      job_id: string;
      production_stage_id: string;
      stage_order: number | null;

      // IMPORTANT: these names match your DB columns
      actual_duration_minutes: number | null;
      estimated_duration_minutes: number | null;
      setup_time_minutes: number | null;
    }>;
  }>;
};

function isHoliday(holidays: Holiday[], day: Date) {
  const y = day.getFullYear(),
    m = String(day.getMonth() + 1).padStart(2, "0"),
    d = String(day.getDate()).padStart(2, "0");
  return holidays.some((h) => h.date.startsWith(`${y}-${m}-${d}`));
}

function dailyWindows(input: ExportInput, day: Date) {
  const dow = day.getDay();
  const todays = input.shifts.filter(
    (s) => s.day_of_week === dow && s.is_working_day
  );

  const windows: Array<{ start: Date; end: Date }> = [];

  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      st.h,
      st.m,
      +st.s
    );
    const end = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      et.h,
      et.m,
      +et.s
    );
    if (end <= start) continue;

    // split by breaks
    let segments = [{ start, end }];
    for (const br of input.meta.breaks ?? []) {
      const bt = parseClock(br.start_time);
      const b0 = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        bt.h,
        bt.m,
        +bt.s
      );
      const b1 = addMin(b0, br.minutes);
      const next: typeof segments = [];
      for (const g of segments) {
        if (b1 <= g.start || b0 >= g.end) {
          next.push(g);
        } else {
          if (g.start < b0) next.push({ start: g.start, end: b0 });
          if (b1 < g.end) next.push({ start: b1, end: g.end });
        }
      }
      segments = next;
    }
    windows.push(...segments);
  }

  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function* iterWindows(input: ExportInput, from: Date, horizonDays = 365) {
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(
      new Date(from.getFullYear(), from.getMonth(), from.getDate()),
      i * 24 * 60
    );
    if (isHoliday(input.holidays, day)) continue;

    for (const w of dailyWindows(input, day)) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function placeDuration(
  input: ExportInput,
  earliest: Date,
  minutes: number
): Array<{ start: Date; end: Date }> {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(earliest);

  for (const w of iterWindows(input, cursor)) {
    if (left <= 0) break;
    const cap = Math.floor(
      (w.end.getTime() - Math.max(w.start.getTime(), cursor.getTime())) / MS
    );
    const use = Math.min(cap, left);
    if (use > 0) {
      const s = new Date(Math.max(w.start.getTime(), cursor.getTime()));
      const e = addMin(s, use);
      placed.push({ start: s, end: e });
      left -= use;
      cursor = e;
    }
  }
  return placed;
}

function nextWorkingStart(input: ExportInput, from: Date) {
  for (const w of iterWindows(input, from, 365)) return w.start;
  return from;
}

/* -------------------- planning -------------------- */
function planSchedule(input: ExportInput, baseStart: Date | null) {
  // only jobs with approval timestamp; order by approval
  const jobs = input.jobs
    .filter((j) => j.proof_approved_at)
    .map((j) => ({ ...j, approvedAt: new Date(j.proof_approved_at!) }))
    .sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<string, Date>(); // production_stage_id -> next free time
  const updates: Array<{
    id: string;
    start_at: string;
    end_at: string;
    minutes: number;
  }> = [];

  for (const job of jobs) {
    // order stages by stage_order
    const stages = [...job.stages].sort(
      (a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999)
    );
    const orders = Array.from(
      new Set(stages.map((s) => s.stage_order ?? 9999))
    ).sort((a, b) => a - b);

    const doneAt = new Map<string, Date>(); // stage instance id -> end time

    for (const ord of orders) {
      const sameOrder = stages.filter(
        (s) (s.stage_order ?? 9999) === ord
      );

      for (const st of sameOrder) {
        const resource = st.production_stage_id;

        // earliest based on job approvedAt, global baseStart, prior stages & resource availability
        let earliest = new Date(job.approvedAt);
        if (baseStart) earliest = new Date(Math.max(earliest.getTime(), baseStart.getTime()));

        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const end = doneAt.get(prev.id);
            if (end && end > earliest) earliest = end;
          }
        }
        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        // ---------- MINUTES (fix: use the correct column names) ----------
        const raw =
          Number.isFinite(st.actual_duration_minutes)
            ? (st.actual_duration_minutes as number)
            : Number.isFinite(st.estimated_duration_minutes)
            ? (st.estimated_duration_minutes as number)
            : 0;

        const setup = Number.isFinite(st.setup_time_minutes)
          ? (st.setup_time_minutes as number)
          : 0;

        // keep a 1-minute floor to avoid zero-length segments
        const mins = Math.max(1, Math.round(raw + setup));

        const segs =
          mins > 0
            ? placeDuration(input, earliest, mins)
            : [{ start: earliest, end: earliest }];

        const start = segs[0].start;
        const end = segs[segs.length - 1].end;

        updates.push({
          id: st.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          minutes: mins,
        });

        doneAt.set(st.id, end);
        resourceFree.set(resource, end);
      }
    }
  }

  return { updates };
}

/* -------------------- HTTP handler -------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const qp = (k: string, def?: unknown) =>
      url.searchParams.get(k) ?? (body as any)[k] ?? def;

    const commit = asBool(qp("commit", true), true);
    const proposed = asBool(qp("proposed", false), false);
    const onlyIfUnset = asBool(qp("onlyIfUnset", true), true);
    const nuclear = asBool(qp("nuclear", false), false);
    const wipeAll = asBool(qp("wipeAll", false), false);

    const startFromStr = String(qp("startFrom", "") ?? "");
    const startFrom = startFromStr ? new Date(startFromStr) : null;

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Export snapshot for the planner
    const { data: snap, error: exportErr } = await supabase.rpc(
      "export_scheduler_input"
    );
    if (exportErr) {
      throw new Error(
        "export_scheduler_input failed: " + JSON.stringify(exportErr)
      );
    }
    const input = snap as ExportInput;

    // 2) Decide base start and optionally wipe existing auto slots
    let baseStart: Date | null = null;
    let unscheduledFromDate: string | null = null;

    if (nuclear) {
      const seed = startFrom ? startFrom : addMin(new Date(), 24 * 60); // default = tomorrow
      baseStart = nextWorkingStart(input, seed);
      unscheduledFromDate = baseStart.toISOString().slice(0, 10);

      if (commit) {
        if (wipeAll) {
          // prefer function signature with wipe_all; fallback to from_date only if not available
          const { error } = await supabase.rpc("unschedule_auto_stages", {
            from_date: unscheduledFromDate,
            wipe_all: true,
          });
          if (error) {
            const { error: e2 } = await supabase.rpc("unschedule_auto_stages", {
              from_date: unscheduledFromDate,
            });
            if (e2) {
              throw new Error(
                "unschedule_auto_stages failed (wipe_all + fallback): " +
                  JSON.stringify({ with_wipe_all: error, fallback: e2 })
              );
            }
          }
        } else {
          const { error } = await supabase.rpc("unschedule_auto_stages", {
            from_date: unscheduledFromDate,
          });
          if (error) {
            throw new Error(
              "unschedule_auto_stages failed: " + JSON.stringify(error)
            );
          }
        }
      }
    }

    // 3) Plan
    const { updates } = planSchedule(input, baseStart);

    // 4) Apply to DB + mirror
    let applied: unknown = { updated: 0 };

    if (commit && updates.length) {
      const { data, error } = await supabase.rpc(
        "apply_stage_updates_safe",
        {
          updates,
          commit: true,
          only_if_unset: onlyIfUnset,
          as_proposed: proposed,
        }
      );
      if (error) {
        throw new Error(
          "apply_stage_updates_safe failed: " + JSON.stringify(error)
        );
      }
      applied = data;

      const ids = updates.map((u) => u.id);
      const { error: mirrorErr } = await supabase.rpc(
        "mirror_jsi_to_stage_time_slots",
        { p_stage_ids: ids }
      );
      if (mirrorErr) {
        throw new Error(
          "mirror_jsi_to_stage_time_slots failed: " +
            JSON.stringify(mirrorErr)
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scheduled: updates.length,
        applied,
        nuclear,
        startFrom: startFromStr || null,
        baseStart: baseStart?.toISOString() ?? null,
        unscheduledFromDate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
