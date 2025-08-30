// supabase/functions/scheduler-run/index.ts
// CORS-hardened scheduler wrapper. Validates payload, strips bad UUIDs,
// and always returns proper CORS headers for POST *and* OPTIONS.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json = Record<string, unknown>;

type RunRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null;
  onlyJobIds?: string[] | null;
};

type RunResult = {
  ok: boolean;
  message: string;
  jobs_considered: number;
  scheduled: number;
  applied: { updated: number };
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsJson(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
function corsOk() {
  // Preflight answer
  return new Response("ok", { status: 200, headers: CORS_HEADERS });
}

function sanitizeUuidList(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const out = x
    .filter((v) => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && UUID_RE.test(v));
  return out.length ? out : null;
}

async function safeJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    const txt = await req.text();
    if (!txt) return null;
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function svcClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : (Deno.env.get("SERVICE_ROLE_KEY") || "");
  return createClient(url, token, { auth: { persistSession: false } });
}

function normalizePayload(body: unknown) {
  const b = (body ?? {}) as Json;

  const onlyJobIds = sanitizeUuidList(b["onlyJobIds"]);
  const startFromRaw =
    typeof b["startFrom"] === "string" && b["startFrom"].trim() !== ""
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

  return {
    used,
    debugEcho: {
      commit: used.commit,
      proposed: used.proposed,
      onlyIfUnset: used.onlyIfUnset,
      nuclear: used.nuclear,
      wipeAll: used.wipeAll,
      startFrom: startFromRaw,
      onlyJobIds: Array.isArray((b as RunRequest).onlyJobIds)
        ? (b as RunRequest).onlyJobIds!
        : null,
    } as RunRequest,
  };
}

async function fetchCandidateJobs(
  sb: SupabaseClient,
  ids: string[] | null,
): Promise<{ id: string; wo_no: string | null }[]> {
  let q = sb.from("production_jobs").select("id, wo_no").is("deleted_at", null);
  if (ids && ids.length) {
    q = q.in("id", ids);
  } else {
    q = q.limit(10000);
  }
  const { data, error } = await q;
  if (error) {
    console.error("select jobs failed", error);
    return [];
  }
  return data ?? [];
}

// TODO: replace with your real scheduling engine.
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
  return { scheduled: candidates.length, updated: 0 };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return corsOk();
  if (req.method !== "POST") {
    return corsJson(405, { ok: false, message: "Method not allowed" });
  }

  const raw = await safeJson<RunRequest>(req);
  const { used, debugEcho } = normalizePayload(raw);
  console.log("scheduler-run payload (raw):", debugEcho);
  console.log("scheduler-run payload (used):", used);

  const sb = svcClient(req);

  try {
    const candidates = await fetchCandidateJobs(sb, used.onlyJobIds);
    console.log(`candidate jobs: ${candidates.length}`);

    const res = await runSchedulerCore(sb, used, candidates);

    const body: RunResult = {
      ok: true,
      message: "ok",
      jobs_considered: candidates.length,
      scheduled: res.scheduled,
      applied: { updated: res.updated },
      used,
    };
    return corsJson(200, body);
  } catch (err) {
    console.error("scheduler-run fatal:", err);
    const body: RunResult = {
      ok: false,
      message: err?.message ?? "unexpected error",
      jobs_considered: 0,
      scheduled: 0,
      applied: { updated: 0 },
      used,
    };
    return corsJson(200, body);
  }
});
