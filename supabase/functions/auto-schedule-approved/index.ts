// supabase/functions/auto-schedule-approved/index.ts
// Sep 24 baseline: Cron-triggered scheduler that calls scheduler-run

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
    console.log("🕐 Auto-schedule-approved triggered by cron");
    
    const url = new URL(req.url);
    const base = `${url.protocol}//${url.host}`;
    const schedulerUrl = `${base}/functions/v1/scheduler-run`;

    // Call scheduler-run with reschedule_all mode
    const payload = {
      commit: true,
      onlyIfUnset: true, // Only schedule unscheduled stages
      source: "cron_auto"
    };

    const response = await fetch(schedulerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Use service role key for internal cron calls
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.text();
    console.log("✅ Cron scheduler completed:", result);

    return new Response(result, {
      status: response.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error("❌ Auto-schedule-approved error:", err);
    return new Response(JSON.stringify({ 
      ok: false, 
      message: err instanceof Error ? err.message : "cron scheduler error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});