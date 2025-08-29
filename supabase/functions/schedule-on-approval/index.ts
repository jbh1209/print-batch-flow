// supabase/functions/schedule-on-approval/index.ts
// Same CORS handling as scheduler-run. Also returns a stub success.
// Your DB trigger can post here; once the core is ready, this can call into
// the same scheduler logic used by scheduler-run.

type HookBody = {
  event?: string;              // e.g. "proof_approved"
  jobId?: string;              // optional
  onlyJobIds?: string[];       // optional alternative
  append?: boolean;            // optional – if true we’ll "append" in the real core
};

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(
  body: unknown,
  init: ResponseInit & { origin?: string | null } = {},
): Response {
  const origin = init.origin ?? null;
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      ...corsHeaders(origin),
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, origin });
  }

  try {
    let body: HookBody = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // STUB RESULT for the approval hook.
    return json(
      {
        ok: true,
        message: "schedule-on-approval stub executed",
        echo: { method: "POST", request: body },
      },
      { status: 200, origin },
    );
  } catch (err) {
    console.error("schedule-on-approval error:", err);
    return json(
      { error: (err as Error).message ?? "Unknown error" },
      { status: 500, origin },
    );
  }
});
