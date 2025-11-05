import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Parse request body with safe defaults
    const body = await req.json();
    const commit = body.commit ?? true;
    const proposed = body.proposed ?? false;
    const onlyIfUnset = body.onlyIfUnset ?? true;
    const onlyJobIds = body.onlyJobIds ?? null;
    const baseStart = body.baseStart ?? null;
    const division = body.division ?? null;
    const debug = body.debug ?? false;

    console.log("scheduler-run invoked:", {
      commit,
      proposed,
      onlyIfUnset,
      division,
      debug,
      jobCount: onlyJobIds?.length ?? "all",
    });

    // Call the existing DB wrapper
    const { data, error } = await supabase.rpc("simple_scheduler_wrapper", {
      p_division: division,
      p_start_from: baseStart,
    });

    if (error) {
      console.error("simple_scheduler_wrapper failed:", error);
      return new Response(
        JSON.stringify({ error: "Scheduler failed", detail: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("scheduler-run completed:", {
      wrote_slots: data?.wrote_slots ?? 0,
      updated_jsi: data?.updated_jsi ?? 0,
      violations: data?.violations?.length ?? 0,
    });

    return new Response(
      JSON.stringify({
        ...data,
        commit,
        onlyIfUnset,
        division,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("scheduler-run error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
