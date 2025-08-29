// supabase/functions/scheduler-run/index.ts
// CORS-solid stub that always responds 200 for both OPTIONS and POST.
// When you're ready, we'll replace the "STUB RESULT" with the real scheduler core.

type SchedulerRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null;
  onlyJobIds?: string[] | null;
};

type SchedulerResponse = {
  ok: true;
  message: string;
  echo: {
    method: string;
    request: SchedulerRequest;
  };
};

function corsHeaders(origin: string | null): HeadersInit {
  // We can echo the origin (or use "*"). Since we are not sending cookies,
  // "*" is fine and simplest.
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

  // 1) Preflight: MUST return 200 + CORS headers or the browser will block the real POST.
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405, origin },
    );
  }

  try {
    // 2) Parse JSON safely; if none, default to empty object.
    let payload: SchedulerRequest = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    // 3) STUB RESULT (always success). This is only to verify that your UI can call the
    //    function without CORS errors. We’ll replace this with the real scheduler next.
    const result: SchedulerResponse = {
      ok: true,
      message: "scheduler-run stub executed",
      echo: { method: "POST", request: payload },
    };

    return json(result, { status: 200, origin });
  } catch (err) {
    // Defensive: always return JSON + CORS on errors too
    console.error("scheduler-run error:", err);
    return json(
      { error: (err as Error).message ?? "Unknown error" },
      { status: 500, origin },
    );
  }
});
