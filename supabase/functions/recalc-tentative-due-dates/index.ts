import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UUID = string;

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 16;
const WORK_END_MINUTE = 30;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://kgizusgqexmlfcqfjopk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "");

function toDateOnly(d: Date): string { return d.toISOString().split("T")[0]; }

async function isHoliday(date: Date): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_public_holiday", { check_date: toDateOnly(date) });
    if (error) return false;
    return Boolean(data);
  } catch { return false; }
}

async function isWorkingDay(date: Date): Promise<boolean> {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !(await isHoliday(date));
}

function withTime(date: Date, hour: number, minute = 0) {
  const d = new Date(date);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function nextWorkingStart(from: Date): Promise<Date> {
  let d = new Date(from);
  while (!(await isWorkingDay(d))) {
    d.setUTCDate(d.getUTCDate() + 1);
    d = withTime(d, WORK_START_HOUR, 0);
  }
  const workStart = withTime(d, WORK_START_HOUR, 0);
  const workEnd = withTime(d, WORK_END_HOUR, WORK_END_MINUTE);
  if (d < workStart) return workStart;
  if (d > workEnd) {
    const n = new Date(d);
    n.setUTCDate(n.getUTCDate() + 1);
    return nextWorkingStart(withTime(n, WORK_START_HOUR, 0));
  }
  return d;
}

async function addWorkingMinutes(start: Date, minutes: number): Promise<Date> {
  const DAILY_CAPACITY_MINUTES = 510; // 8.5 hours (8:00-16:30)
  let remaining = minutes;
  let current = await nextWorkingStart(start);
  
  while (remaining > 0) {
    const dayEnd = withTime(current, WORK_END_HOUR, WORK_END_MINUTE);
    const availableInDay = Math.max(0, Math.floor((dayEnd.getTime() - current.getTime()) / 60000));
    
    if (remaining <= availableInDay) {
      return new Date(current.getTime() + remaining * 60000);
    }
    
    // Job doesn't fit - move entire remaining duration to next working day
    const nextDay = new Date(current);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    current = await nextWorkingStart(withTime(nextDay, WORK_START_HOUR, 0));
    // Keep full remaining duration for next day
  }
  return current;
}

async function getStageQueueEnd(stageId: UUID): Promise<Date | null> {
  const { data } = await supabase
    .from("job_stage_instances")
    .select("scheduled_end_at")
    .eq("production_stage_id", stageId)
    .not("scheduled_end_at", "is", null)
    .order("scheduled_end_at", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  return new Date(data[0].scheduled_end_at as string);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Midnight baseline
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    // Find jobs waiting in DTP/Proof without approval
    // Strategy: jobs having a pending Proof stage with proof_approved_manually_at IS NULL
    const { data: pendingProofStages, error } = await supabase
      .from("job_stage_instances")
      .select("job_id, job_table_name, production_stages:production_stage_id(name), proof_approved_manually_at")
      .is("proof_approved_manually_at", null)
      .eq("status", "pending");

    if (error) {
      console.error("Fetch pending proof stages error", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const uniqueJobs = new Map<string, { job_id: UUID; job_table_name: string }>();
    for (const row of pendingProofStages ?? []) {
      const name = (row as any).production_stages?.name?.toLowerCase?.() ?? "";
      if (name.includes("proof")) {
        uniqueJobs.set((row as any).job_id, { job_id: (row as any).job_id, job_table_name: (row as any).job_table_name });
      }
    }

    const results: Array<{ job_id: UUID; tentative_due_date: string }> = [];

    for (const { job_id, job_table_name } of uniqueJobs.values()) {
      // Fetch stages for this job (pending/active)
      const { data: stages } = await supabase
        .from("job_stage_instances")
        .select("id, production_stage_id, stage_order, status, estimated_duration_minutes")
        .eq("job_id", job_id)
        .eq("job_table_name", job_table_name)
        .in("status", ["pending", "active"]) // simulate future flow
        .order("stage_order", { ascending: true });

      let pointer = new Date(midnight);
      let lastEnd: Date | null = null;

      for (const s of stages ?? []) {
        const minutes = (s as any).estimated_duration_minutes ?? 60;
        const queueEnd = (await getStageQueueEnd((s as any).production_stage_id)) ?? new Date(midnight);
        const startCandidate = new Date(Math.max(pointer.getTime(), queueEnd.getTime()));
        const scheduledStart = await nextWorkingStart(startCandidate);
        const scheduledEnd = await addWorkingMinutes(scheduledStart, minutes);
        pointer = new Date(scheduledEnd);
        lastEnd = new Date(scheduledEnd);
      }

      if (lastEnd) {
        const bufferEnd = await addWorkingMinutes(lastEnd, 8 * 60); // +1 working day
        const tentative = toDateOnly(bufferEnd);
        const { error: upErr } = await supabase
          .from("production_jobs")
          .update({ tentative_due_date: tentative, updated_at: new Date().toISOString() })
          .eq("id", job_id);
        if (!upErr) {
          results.push({ job_id, tentative_due_date: tentative });
        } else {
          console.error("Failed updating tentative due date", upErr);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[recalc-tentative-due-dates] error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
