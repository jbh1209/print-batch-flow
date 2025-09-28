// supabase/functions/schedule-on-approval/index.ts
// Thin CORS-aware proxy to /functions/v1/scheduler-run

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function corsOk() {
  return new Response("ok", { status: 200, headers: CORS_HEADERS });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return corsOk();
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const bodyText = await req.text();
    const url = new URL(req.url);
    const base = `${url.protocol}//${url.host}`;
    const target = `${base}/functions/v1/scheduler-run`;

    const fwd = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // forward the same auth header your UI sets (Bearer <SERVICE_ROLE_KEY>)
        authorization: req.headers.get("authorization") ?? "",
      },
      body: bodyText,
    });

    const payload = await fwd.text(); // pass-through payload
    return new Response(payload, {
      status: fwd.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error("schedule-on-approval proxy error:", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : "proxy error" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
