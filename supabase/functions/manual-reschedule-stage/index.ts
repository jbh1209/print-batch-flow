// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
);

function toStartOfDay(dateStr: string, hour = 8, minute = 0) {
  const d = new Date(`${dateStr}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00.000Z`);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // Sun=0, Sat=6
}

async function getDailyCapacityMinutes(stageId: string): Promise<number> {
  const { data } = await supabase
    .from("stage_capacity_profiles")
    .select("daily_capacity_hours")
    .eq("production_stage_id", stageId)
    .maybeSingle();
  return ((data?.daily_capacity_hours as number | null) ?? 8) * 60;
}

async function getUsedMinutes(stageId: string, dayIso: string): Promise<number> {
  const dayStart = toStartOfDay(dayIso, 8, 0).toISOString();
  const nextDay = addMinutes(toStartOfDay(dayIso, 8, 0), 24 * 60).toISOString();
  const { data, error } = await supabase
    .from("job_stage_instances")
    .select("scheduled_minutes")
    .eq("production_stage_id", stageId)
    .gte("scheduled_start_at", dayStart)
    .lt("scheduled_start_at", nextDay);
  if (error) return 0;
  return (data || []).reduce((sum: number, r: any) => sum + (r.scheduled_minutes || 0), 0);
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stage_instance_id, target_date, production_stage_id, job_table_name } = await req.json();
    if (!stage_instance_id || !target_date) {
      return new Response(JSON.stringify({ ok: false, error: "stage_instance_id and target_date are required" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Load the stage instance
    const { data: jsi, error: jsiErr } = await supabase
      .from("job_stage_instances")
      .select("id, production_stage_id, scheduled_minutes, estimated_duration_minutes, setup_time_minutes")
      .eq("id", stage_instance_id)
      .maybeSingle();
    if (jsiErr || !jsi) {
      throw new Error(jsiErr?.message || "Stage instance not found");
    }

    const stageId = production_stage_id || jsi.production_stage_id as string;

    const totalMinutes = (jsi.scheduled_minutes as number | null)
      ?? ((jsi.estimated_duration_minutes as number | null) ?? 60) + ((jsi.setup_time_minutes as number | null) ?? 0);

    // Compute start based on existing load of day
    const capMinutes = await getDailyCapacityMinutes(stageId);
    let day = new Date(`${target_date}T00:00:00.000Z`);
    // Move to Monday-Friday if weekend
    while (isWeekend(day)) {
      day = addMinutes(day, 24 * 60);
    }
    const dayStr = day.toISOString().slice(0, 10);
    const dayStart = toStartOfDay(dayStr, 8, 0);
    const dayEnd = toStartOfDay(dayStr, 16, 30);

    const used = await getUsedMinutes(stageId, dayStr);
    let cursor = addMinutes(dayStart, Math.min(used, capMinutes));

    // If overflows the day, roll to next working day at 8:00
    while (cursor >= dayEnd) {
      day = addMinutes(day, 24 * 60);
      while (isWeekend(day)) day = addMinutes(day, 24 * 60);
      const ndStr = day.toISOString().slice(0, 10);
      const ndStart = toStartOfDay(ndStr, 8, 0);
      cursor = ndStart;
    }

    // Compute end carrying over non-working hours
    let remaining = totalMinutes;
    let current = new Date(cursor);

    while (remaining > 0) {
      const curDayStr = current.toISOString().slice(0, 10);
      const curStart = toStartOfDay(curDayStr, 8, 0);
      const curEnd = toStartOfDay(curDayStr, 16, 30);

      // Determine free minutes today from current position to curEnd
      const freeToday = Math.max(0, Math.round((curEnd.getTime() - current.getTime()) / 60000));
      if (freeToday >= remaining) {
        current = addMinutes(current, remaining);
        remaining = 0;
      } else {
        remaining -= freeToday;
        // Move to next working day start
        let next = addMinutes(curEnd, 15); // small gap
        next = toStartOfDay(next.toISOString().slice(0,10), 8, 0);
        while (isWeekend(next)) next = addMinutes(next, 24 * 60);
        current = next;
      }
    }

    const scheduled_start_at = cursor.toISOString();
    const scheduled_end_at = current.toISOString();

    const { error: upErr } = await supabase
      .from("job_stage_instances")
      .update({
        scheduled_start_at,
        scheduled_end_at,
        scheduled_minutes: totalMinutes,
        schedule_status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq("id", stage_instance_id);

    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, scheduled_start_at, scheduled_end_at }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("manual-reschedule-stage error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}

Deno.serve(handler);
