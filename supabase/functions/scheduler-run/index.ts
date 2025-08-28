// supabase/functions/scheduler-run/index.ts
// Canonical scheduler HTTP entrypoint (used by Schedule Board "Reschedule All" AND by the auto-approve proxy below)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

type RunRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null;     // YYYY-MM-DD or ISO
  onlyJobIds?: string[] | null;  // restrict scope
  baseStart?: string | null;     // explicit ISO start for append
};

type RunResult = {
  ok: boolean;
  jobs_considered: number;
  scheduled: number;
  applied: { updated: number };
  note?: string;
};

const url  = Deno.env.get("SUPABASE_URL")!;
const key  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
}

function sb(): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Return the next valid working start (Mon–Fri 08:00; holidays excluded; never in the past). */
async function getNextWorkingStart(s: SupabaseClient, hint?: string | null): Promise<Date> {
  const now = new Date();
  let d = hint ? new Date(hint) : now;

  // force date only if just a date string
  if (/^\d{4}-\d{2}-\d{2}$/.test(hint ?? "")) {
    d = new Date(`${hint}T00:00:00Z`);
  }

  // clamp into the future
  if (d < now) d = now;

  // normalize to 08:00 local plant time (you can change this to use a TZ if needed)
  d.setUTCHours(8, 0, 0, 0);

  // shift calendar: public.shift_schedules (0=Sun … 6=Sat), public.public_holidays(date,is_active)
  while (true) {
    const dayOfWeek = d.getUTCDay(); // 0..6
    const { data: shift } = await s
      .from("shift_schedules")
      .select("is_working_day,start_time,end_time")
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();

    const { data: hol } = await s
      .from("public_holidays")
      .select("date,is_active")
      .eq("date", d.toISOString().slice(0, 10))
      .eq("is_active", true)
      .maybeSingle();

    const isWorking = shift?.is_working_day && !hol;
    if (isWorking) break;

    // advance by 1 day at 08:00
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    d.setUTCHours(8, 0, 0, 0);
  }

  return d;
}

/** Append case: compute the latest slot_end_time across all stages for target queue. */
async function getQueueTailForAppend(s: SupabaseClient, firstStageId: string): Promise<Date> {
  // Find queue by stage id (production_stage_id)
  const { data: maxEnd } = await s
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", firstStageId)
    .order("slot_end_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = maxEnd?.slot_end_time ? new Date(maxEnd.slot_end_time) : new Date();
  if (base < new Date()) return new Date(); // don’t go into the past
  return base;
}

/** Your scheduling core — currently a minimal stub that returns success.
 * Replace this with your working engine when you’re ready.
 */
async function executeScheduler(
  s: SupabaseClient,
  request: Required<Pick<RunRequest, "commit" | "proposed" | "onlyIfUnset" | "nuclear" | "wipeAll">> &
            { startFromISO: string; onlyJobIds: string[] }
): Promise<RunResult> {
  // TODO: plug in your real algorithm here. The wrapper has already:
  //  - normalized startFrom to a valid working start in request.startFromISO
  //  - wiped existing slots if request.nuclear or request.wipeAll
  //  - restricted scope to request.onlyJobIds (if provided)
  // For now, we simply return ok without changing anything, so you can verify 200s.
  return { ok: true, jobs_considered: 0, scheduled: 0, applied: { updated: 0 }, note: "stub" };
}

serve(async (req) => {
  try {
    const body = (await req.json().catch(() => ({}))) as RunRequest;

    // defaults
    const commit      = body.commit      ?? true;
    const proposed    = body.proposed    ?? false;
    const onlyIfUnset = body.onlyIfUnset ?? false;
    const nuclear     = body.nuclear     ?? false;
    const wipeAll     = body.wipeAll     ?? false;
    const onlyJobIds  = (body.onlyJobIds ?? []) as string[];

    // Normalize startFrom
    const startFrom = await getNextWorkingStart(sb(), body.startFrom ?? body.baseStart ?? null);

    // If append-only (typical auto-approve single job) we’ll also honor baseStart if supplied
    // NOTE: If you want true queue-append here, compute it with getQueueTailForAppend()
    // when onlyJobIds has exactly one job and you want per-queue tail behavior.

    // Wipe (if needed)
    if (nuclear || wipeAll) {
      // remove all future slots from today forward
      await sb().from("stage_time_slots").delete().gte("slot_start_time", new Date().toISOString());
    }

    const result = await executeScheduler(sb(), {
      commit,
      proposed,
      onlyIfUnset,
      nuclear,
      wipeAll,
      startFromISO: startFrom.toISOString(),
      onlyJobIds,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scheduler-run error:", err);
    return new Response(JSON.stringify({ ok: false, error: `${err}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
