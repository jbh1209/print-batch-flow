// supabase/functions/schedule-on-approval/index.ts
// Thin forwarder to the canonical scheduler-run endpoint.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const URL  = Deno.env.get("SUPABASE_URL")!;
const SRK  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
if (!URL || !SRK) console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");

serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const res = await fetch(`${URL}/functions/v1/scheduler-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SRK}`,
        "x-client-info": "schedule-on-approval-proxy",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("schedule-on-approval proxy error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
