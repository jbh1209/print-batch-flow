// Edge Function: scheduler-run
// Place at: supabase/functions/scheduler-run/index.ts

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

// ---------- Config ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- Types ----------
type UUID = string;

type SchedulerRequest = {
  commit?: boolean;         // do inserts or just simulate
  proposed?: boolean;       // (accepted but not used; kept for compatibility)
  onlyIfUnset?: boolean;    // skip a stage that already has slots
  nuclear?: boolean;        // (accepted, no destructive behavior here)
  onlyJobIds?: UUID[];      // schedule for these jobs only
  baseStart?: string | null;// floor start time (ISO); used for first stage of each job
};

type StageRow = {
  id: UUID; // job_stage_instances.id
  job_id: UUID;
  production_stage_id: UUID;
  stage_order: number | null;

  // minutes sources
  scheduled_minutes: number | null;
  estimated_duration_minutes: number | null;
  setup_time_minutes: number | null;

  status: string | null;
};

type ResultRow = {
  job_id: UUID;
  stage_instance_id: UUID;
  production_stage_id: UUID;
  minutes: number;
  start_at: string; // ISO
  end_at: string;   // ISO
  applied: boolean;
  reason?: string;
};

// ---------- Small helpers ----------
const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    },
  });

const notAllowed = () =>
  ok({ error: "Method not allowed" }, 405);

const addMinutes = (d: Date, mins: number) =>
  new Date(d.getTime() + mins * 60_000);

/**
 * If you have working-shift constraints, replace this
 * with your existing “ceil to next valid working instant”
 * implementation. For now it simply returns `dt`.
 */
const ceilToShift = (dt: Date) => dt;

/** Latest slot_end_time for a production stage (the queue tail). */
async function getQueueTail(stageId: UUID): Promise<Date | null> {
  const { data, error } = await supabase
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", stageId)
    .order("slot_end_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.slot_end_time) return null;
  return new Date(data.slot_end_time);
}

/** Does this stage already have any slots? */
async function stageHasSlots(stageInstanceId: UUID): Promise<boolean> {
  const { count, error } = await supabase
    .from("stage_time_slots")
    .select("*", { count: "exact", head: true })
    .eq("stage_instance_id", stageInstanceId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Pull pending/queued stages for a job (sorted by stage order). */
async function fetchStagesForJob(jobId: UUID): Promise<StageRow[]> {
  const { data, error } = await supabase
    .from("job_stage_instances")
    .select(
      [
        "id",
        "job_id",
        "production_stage_id",
        "stage_order",
        "scheduled_minutes",
        "estimated_duration_minutes",
        "setup_time_minutes",
        "status",
      ].join(", "),
    )
    .eq("job_id", jobId)
    .in("status", ["pending", "queued"])
    .order("stage_order", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as StageRow[];
}

/** Compute the minutes we will schedule for a stage. */
function computeMinutes(stg: StageRow): number {
  const fromScheduled = stg.scheduled_minutes ?? 0;
  const fromEstimate =
    (stg.estimated_duration_minutes ?? 0) +
    (stg.setup_time_minutes ?? 0);

  const m = Math.max(1, fromScheduled, fromEstimate);
  return Number.isFinite(m) ? m : 1;
}

/**
 * The one-and-only placement rule:
 *   start_at = max(prev_end_for_this_job, stage_queue_tail, baseStart?)
 */
async function planStage(
  stg: StageRow,
  prevEnd: Date | null,
  baseStartForJob: Date | null,
  onlyIfUnset: boolean,
  commit: boolean,
): Promise<ResultRow> {
  // If onlyIfUnset, skip stages that already have slots.
  if (onlyIfUnset) {
    const has = await stageHasSlots(stg.id);
    if (has) {
      return {
        job_id: stg.job_id,
        stage_instance_id: stg.id,
        production_stage_id: stg.production_stage_id,
        minutes: 0,
        start_at: new Date().toISOString(),
        end_at: new Date().toISOString(),
        applied: false,
        reason: "already-slotted",
      };
    }
  }

  const minutes = computeMinutes(stg);

  const queueTail = await getQueueTail(stg.production_stage_id);

  // floor for first stage of job (if provided)
  const baseFloor = baseStartForJob ?? null;

  const baseEpoch = Math.max(
    prevEnd ? prevEnd.getTime() : 0,
    queueTail ? queueTail.getTime() : 0,
    baseFloor ? baseFloor.getTime() : 0,
    Date.now(), // never in the past
  );

  const startAt = ceilToShift(new Date(baseEpoch));
  const endAt = addMinutes(startAt, minutes);

  if (commit) {
    // Insert a slot. DB guardrails (triggers) will enforce precedence and sane durations.
    const { error: insErr } = await supabase
      .from("stage_time_slots")
      .insert({
        production_stage_id: stg.production_stage_id,
        stage_instance_id: stg.id,
        slot_start_time: startAt.toISOString(),
        slot_end_time: endAt.toISOString(),
      });

    if (insErr) {
      return {
        job_id: stg.job_id,
        stage_instance_id: stg.id,
        production_stage_id: stg.production_stage_id,
        minutes,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        applied: false,
        reason: `insert-failed: ${insErr.message}`,
      };
    }
  }

  return {
    job_id: stg.job_id,
    stage_instance_id: stg.id,
    production_stage_id: stg.production_stage_id,
    minutes,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    applied: commit,
  };
}

/** Schedule all pending/queued stages for a single job.id */
async function scheduleJob(
  jobId: UUID,
  options: {
    commit: boolean;
    onlyIfUnset: boolean;
    baseStart: Date | null;
  },
): Promise<{ planned: ResultRow[] }> {
  const stages = await fetchStagesForJob(jobId);

  const planned: ResultRow[] = [];
  let prevEnd: Date | null = null;

  for (let i = 0; i < stages.length; i++) {
    const stg = stages[i];
    const isFirstStage = i === 0;

    const res = await planStage(
      stg,
      prevEnd,
      isFirstStage ? options.baseStart : null,
      options.onlyIfUnset,
      options.commit,
    );

    planned.push(res);

    // advance prevEnd for this job chain when we actually planned something
    if (res.applied || !options.commit) {
      prevEnd = new Date(res.end_at);
    }
  }

  return { planned };
}

// ---------- Main entry point ----------
async function executeScheduler(reqBody: SchedulerRequest) {
  const commit = !!reqBody.commit;
  const onlyIfUnset = reqBody.onlyIfUnset ?? true;

  const baseStart =
    reqBody.baseStart ? new Date(reqBody.baseStart) : null;

  let jobIds: UUID[] = [];

  if (Array.isArray(reqBody.onlyJobIds) && reqBody.onlyJobIds.length > 0) {
    jobIds = reqBody.onlyJobIds;
  } else {
    // If none supplied, consider all jobs that still have pending/queued stages.
    const { data, error } = await supabase
      .from("job_stage_instances")
      .select("job_id")
      .in("status", ["pending", "queued"])
      .order("created_at", { ascending: true });

    if (error) throw error;
    jobIds = Array.from(new Set((data ?? []).map((r: any) => r.job_id)));
  }

  const out: ResultRow[] = [];
  for (const jobId of jobIds) {
    const { planned } = await scheduleJob(jobId, {
      commit,
      onlyIfUnset,
      baseStart,
    });
    out.push(...planned);
  }

  // Compact summary
  const scheduled = out.filter(r => r.applied).length;
  const jobsConsidered = jobIds.length;

  return {
    ok: true,
    jobs_considered: jobsConsidered,
    scheduled,
    applied: scheduled,
    nuclear: !!reqBody.nuclear,
    onlyIfUnset,
    baseStart: baseStart ? baseStart.toISOString() : null,
    items: out,
  };
}

// ---------- HTTP handler with CORS ----------
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return ok({ ok: true });
  }

  if (req.method === "GET") {
    return ok({ ok: true, service: "scheduler-run", time: new Date().toISOString() });
  }

  if (req.method !== "POST") return notAllowed();

  let body: SchedulerRequest;
  try {
    body = await req.json();
  } catch {
    return ok({ error: "Invalid JSON body" }, 400);
  }

  try {
    const resp = await executeScheduler(body);
    return ok(resp);
  } catch (err: any) {
    console.error("scheduler-run error:", err);
    return ok({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});
