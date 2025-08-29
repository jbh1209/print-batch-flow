import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const res = await fetch(`${URL}/functions/v1/scheduler-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SRK}`,
        "x-client-info": "simple-scheduler-proxy",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("simple-scheduler proxy error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
