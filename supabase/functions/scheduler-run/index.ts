// File: supabase/functions/scheduler-run/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // ---- STUB RESULT (proves wiring + CORS) ----
    const result = {
      ok: true,
      message: "scheduler-run stub ok",
      echo: body ?? {},
      scheduled: 0,
      jobs_considered: 0,
      applied: { updated: 0 },
    };
    // -------------------------------------------

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scheduler-run error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
