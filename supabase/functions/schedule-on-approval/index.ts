// supabase/functions/schedule-on-approval/index.ts
// Thin compatibility wrapper: forwards body to /functions/v1/scheduler-run

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const base = Deno.env.get("SUPABASE_URL")!;
const key  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
if (!base || !key) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const res = await fetch(`${base}/functions/v1/scheduler-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // service role auth so it can call the sibling function
        "Authorization": `Bearer ${key}`,
        "x-client-info": "edge-proxy/schedule-on-approval",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    console.error("schedule-on-approval proxy error:", err);
    return new Response(JSON.stringify({ ok: false, error: `${err}` }), { status: 500 });
  }
});
