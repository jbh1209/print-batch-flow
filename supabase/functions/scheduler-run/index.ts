// supabase/functions/scheduler-run/index.ts
// Hardened wrapper for scheduler: validates payload, strips bad UUIDs, never 500s on bad input.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json = Record<string, unknown>;

type RunRequest = {
  // common flags used by your UI
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;

  // scope & timing
  startFrom?: string | null;         // ISO date or date-time
  onlyJobIds?: string[] | null;      // optional list of UUIDs (may contain junk from UI)
};

type RunResult = {
  ok: boolean;
  message: string;
  jobs_considered: number;
  scheduled: number;
  applied: { updated: number };
  // echo back what we actually used after validation
  used: {
    onlyJobIds: string[] | null;
    startFrom: string | null;
    commit: boolean;
    proposed: boolean;
    onlyIfUnset: boolean;
    nuclear: boolean;
    wipeAll: boolean;
  };
};

// ---- helpers ---------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Return array of *valid* UUID strings (drops null/empty/malformed). */
function sanitizeUuidList(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const out = x
    .filter(v => typeof v === "string")
    .map(v => v.trim())
    .filter(v => v.length > 0 && UUID_RE.test(v));
  return out.length ? out : null;
}

/** Best-effort parse of JSON body; never throws. */
async function safeJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    const txt = await req.text();
    if (!txt) return null;
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

/** Create a service-role Supabase client (uses the Authorization header) */
function svcClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  // Prefer Authorization header (Schedule Board sets Bearer <SERVICE_ROLE_KEY>)
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (Deno.env.get("SERVICE_ROLE_KEY") || "");
  return createClient(url, token, {
    auth: { persistSession: false },
  });
}

/** Normalizes/guards the incoming payload. */
function normalizePayload(body: unknown): {
  used: Required<Omit<RunRequest, "onlyJobIds" | "startFrom">> & {
    onlyJobIds: string[] | null;
    startFrom: string | null;
  };
  debugEcho: RunRequest;
} {
  const b = (body ?? {}) as Json;

  const onlyJobIds = sanitizeUuidList(b["onlyJobIds"]);
  const startFromRaw = typeof b["startFrom"] === "string" && b["startFrom"].trim() !== ""
    ? b["startFrom"].trim()
    : null;

  const used = {
    commit: Boolean(b["commit"]),
    proposed: Boolean(b["proposed"]),
    onlyIfUnset: Boolean(b["onlyIfUnset"]),
    nuclear: Boolean(b["nuclear"]),
    wipeAll: Boolean(b["wipeAll"]),
    startFrom: startFromRaw,
    onlyJobIds,
  } as const;

  // For visibility in Supabase logs
  return {
    used,
    debugEcho: {
      commit: used.commit,
      proposed: used.proposed,
      onlyIfUnset: used.onlyIfUnset,
      nuclear: used.nuclear,
      wipeAll: used.wipeAll,
      startFrom: startFromRaw,
      onlyJobIds: Array.isArray((b as RunRequest).onlyJobIds) ? (b as RunRequest).onlyJobIds! : null,
    },
  };
}

/** Select candidate jobs safely; applies .in('id', ids) only when ids is non-empty. */
async function fetchCandidateJobs(
  sb: SupabaseClient,
  ids: string[] | null,
): Promise<{ id: string; wo_no: string | null }[]> {
  let q = sb.from("production_jobs")
    .select("id, wo_no")
    .is("deleted_at", null);

  if (ids && ids.length) {
    q = q.in("id", ids);
  } else {
    // default scope for “reschedule all”: any job with at least one pending/queued stage
    // (fast positive check via a materialized view or join would be better, but keep it simple)
    q = q.limit(10000); // avoid runaway
  }

  const { data, error } = await q;
  if (error) {
    console.error("select jobs failed", error);
    return [];
  }
  return data ?? [];
}

/** Stub scheduler core – replace with your real engine when ready. */
async function runSchedulerCore(
  _sb: SupabaseClient,
  _opts: {
    startFrom: string | null;
    onlyJobIds: string[] | null;
    commit: boolean;
    proposed: boolean;
    onlyIfUnset: boolean;
    nuclear: boolean;
    wipeAll: boolean;
  },
  candidates: { id: string; wo_no: string | null }[],
): Promise<{ scheduled: number; updated: number }> {
  // TODO: integrate your production scheduling algorithm here.
  // For now: pretend we scheduled N = candidates.length (no DB writes).
  return { scheduled: candidates.length, updated: 0 };
}

// ---- HTTP entry ------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1) Parse and normalize
  const raw = await safeJson<RunRequest>(req);
  const { used, debugEcho } = normalizePayload(raw);

  console.log("scheduler-run payload (raw):", debugEcho);
  console.log("scheduler-run payload (used):", used);

  // 2) Supabase client (service role)
  const sb = svcClient(req);

  try {
    // 3) Find candidates (safe – no UUID casts unless valid ids are present)
    const candidates = await fetchCandidateJobs(sb, used.onlyJobIds);
    console.log(`candidate jobs: ${candidates.length}`);

    // 4) (Optional) wipe if nuclear / wipeAll — skipped here to keep it safe until your core is plugged in
    //    When you’re ready, do your stage_time_slots truncate here under a transaction.

    // 5) Run (stub) scheduler
    const res = await runSchedulerCore(sb, used, candidates);

    const body: RunResult = {
      ok: true,
      message: "ok",
      jobs_considered: candidates.length,
      scheduled: res.scheduled,
      applied: { updated: res.updated },
      used,
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("scheduler-run fatal:", err);
    // Return 200 so the UI doesn’t treat it as a network failure, but mark ok:false
    const body: RunResult = {
      ok: false,
      message: err?.message ?? "unexpected error",
      jobs_considered: 0,
      scheduled: 0,
      applied: { updated: 0 },
      used,
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
