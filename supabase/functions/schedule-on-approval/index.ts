import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UUID = string;

interface SchedulingRequest {
  job_id: UUID;
  job_table_name?: string; // default 'production_jobs'
}

interface StageInstance {
  id: UUID;
  production_stage_id: UUID;
  stage_order: number;
  status: string;
  estimated_duration_minutes: number | null;
  started_at: string | null;
  proof_approved_manually_at: string | null;
}

// Working hours configuration (can be extended from DB later)
const WORK_START_HOUR = 8; // 08:00
const WORK_END_HOUR = 16; // 16:30 handled via minutes
const WORK_END_MINUTE = 30;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://kgizusgqexmlfcqfjopk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set - updates may fail due to RLS");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "");

function toDateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function isHoliday(date: Date): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_public_holiday", {
      check_date: toDateOnly(date),
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

async function isWorkingDay(date: Date): Promise<boolean> {
  const day = date.getUTCDay(); // 0 Sun .. 6 Sat (UTC)
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
  // Align to working window
  while (!(await isWorkingDay(d))) {
    d.setUTCDate(d.getUTCDate() + 1);
    d = withTime(d, WORK_START_HOUR, 0);
  }
  const workStart = withTime(d, WORK_START_HOUR, 0);
  const workEnd = withTime(d, WORK_END_HOUR, WORK_END_MINUTE);
  if (d < workStart) return workStart;
  if (d > workEnd) {
    // move to next day start
    const n = new Date(d);
    n.setUTCDate(n.getUTCDate() + 1);
    return nextWorkingStart(withTime(n, WORK_START_HOUR, 0));
  }
  return d;
}

async function addWorkingMinutes(start: Date, minutes: number): Promise<Date> {
  let remaining = minutes;
  let current = await nextWorkingStart(start);
  while (remaining > 0) {
    const dayEnd = withTime(current, WORK_END_HOUR, WORK_END_MINUTE);
    const diffMin = Math.max(0, Math.floor((dayEnd.getTime() - current.getTime()) / 60000));
    if (remaining <= diffMin) {
      return new Date(current.getTime() + remaining * 60000);
    }
    // consume till end, then jump to next working day start
    remaining -= diffMin;
    const n = new Date(current);
    n.setUTCDate(n.getUTCDate() + 1);
    current = await nextWorkingStart(withTime(n, WORK_START_HOUR, 0));
  }
  return current;
}

async function getStageQueueEnd(stageId: UUID): Promise<Date | null> {
  const { data, error } = await supabase
    .from("job_stage_instances")
    .select("scheduled_end_at")
    .eq("production_stage_id", stageId)
    .not("scheduled_end_at", "is", null)
    .order("scheduled_end_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return new Date(data[0].scheduled_end_at as string);
}

async function getJobIsExpedited(jobId: UUID): Promise<boolean> {
  const { data, error } = await supabase
    .from("production_jobs")
    .select("is_expedited")
    .eq("id", jobId)
    .single();
  if (error || !data) return false;
  return Boolean(data.is_expedited);
}

async function computeDueDateFromCompletion(completion: Date): Promise<string> {
  // Add 1 working day buffer
  const withBuffer = await addWorkingMinutes(completion, (8 * 60));
  return toDateOnly(withBuffer);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SchedulingRequest;
    const jobId = body.job_id;
    const jobTable = body.job_table_name ?? "production_jobs";

    console.log("[schedule-on-approval] start job", jobId, jobTable);

    // Fetch stages for this job
    const { data: stages, error: stagesError } = await supabase
      .from("job_stage_instances")
      .select("id, production_stage_id, stage_order, status, estimated_duration_minutes, started_at, proof_approved_manually_at")
      .eq("job_id", jobId)
      .eq("job_table_name", jobTable)
      .in("status", ["pending", "active"]) // schedule pending/active forward
      .order("stage_order", { ascending: true });

    if (stagesError) {
      console.error("Failed to fetch stages", stagesError);
      return new Response(JSON.stringify({ error: stagesError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expedited = await getJobIsExpedited(jobId);

    let pointer = new Date();
    let lastEnd: Date | null = null;
    const scheduleResults: Array<{ stage_instance_id: UUID; start: string; end: string; minutes: number }> = [];

    for (const s of (stages as StageInstance[])) {
      const minutes = s.estimated_duration_minutes ?? 60; // default 1h
      const queueEnd = (await getStageQueueEnd(s.production_stage_id)) ?? new Date();

      // base candidate: after previous stage and after existing queue end
      let startCandidate = new Date(Math.max(pointer.getTime(), queueEnd.getTime()));
      if (expedited) {
        // expedited: still respect existing schedule to avoid overlaps (simple v1)
        startCandidate = new Date(Math.max(pointer.getTime(), queueEnd.getTime()));
      }

      const scheduledStart = await nextWorkingStart(startCandidate);
      const scheduledEnd = await addWorkingMinutes(scheduledStart, minutes);

      // update DB for this stage instance
      const { error: updateErr } = await supabase
        .from("job_stage_instances")
        .update({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at: scheduledEnd.toISOString(),
          scheduled_minutes: minutes,
          schedule_status: "scheduled",
        })
        .eq("id", s.id);

      if (updateErr) {
        console.error("Failed updating stage schedule", s.id, updateErr);
        continue; // proceed with others
      }

      scheduleResults.push({ stage_instance_id: s.id, start: scheduledStart.toISOString(), end: scheduledEnd.toISOString(), minutes });
      pointer = new Date(scheduledEnd);
      lastEnd = new Date(scheduledEnd);
    }

    if (lastEnd) {
      // Update job dates: internal_completion_date and due_date (+1 working day buffer)
      const internalCompletionDate = toDateOnly(lastEnd);
      const dueDate = await computeDueDateFromCompletion(lastEnd);

      // Fetch job lock status
      const { data: jobData } = await supabase
        .from("production_jobs")
        .select("due_date_locked")
        .eq("id", jobId)
        .single();

      const updatePayload: Record<string, any> = {
        internal_completion_date: internalCompletionDate,
        last_due_date_check: new Date().toISOString(),
      };
      if (!jobData || jobData.due_date_locked !== true) {
        updatePayload.due_date = dueDate;
        updatePayload.due_date_warning_level = "green";
      }

      const { error: jobUpdateErr } = await supabase
        .from("production_jobs")
        .update(updatePayload)
        .eq("id", jobId);
      if (jobUpdateErr) {
        console.error("Failed updating job dates", jobUpdateErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, scheduled: scheduleResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[schedule-on-approval] error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
