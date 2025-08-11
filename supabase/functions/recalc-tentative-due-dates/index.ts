import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UUID = string;

interface WorkingHoursConfig {
  work_start_hour: number;
  work_end_hour: number;
  work_end_minute: number;
  busy_period_active: boolean;
  busy_start_hour: number;
  busy_end_hour: number;
  busy_end_minute: number;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://kgizusgqexmlfcqfjopk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "");

async function getWorkingHoursConfig(): Promise<WorkingHoursConfig> {
  const { data, error } = await supabase.rpc('get_working_hours_config');
  
  if (error || !data || data.length === 0) {
    console.warn("Failed to get working hours config, using defaults:", error);
    return {
      work_start_hour: 8,
      work_end_hour: 16,
      work_end_minute: 30,
      busy_period_active: false,
      busy_start_hour: 8,
      busy_end_hour: 18,
      busy_end_minute: 0
    };
  }
  
  return data[0] as WorkingHoursConfig;
}

function toDateOnly(d: Date): string { 
  return d.toISOString().split("T")[0]; 
}

async function isHoliday(date: Date): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_public_holiday", { 
      check_date: toDateOnly(date) 
    });
    if (error) return false;
    return Boolean(data);
  } catch { 
    return false; 
  }
}

async function isWorkingDay(date: Date): Promise<boolean> {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !(await isHoliday(date));
}

function withTime(date: Date, hour: number, minute = 0): Date {
  const d = new Date(date);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function nextWorkingStart(from: Date): Promise<Date> {
  const config = await getWorkingHoursConfig();
  const startHour = config.busy_period_active ? config.busy_start_hour : config.work_start_hour;
  
  let d = new Date(from);
  while (!(await isWorkingDay(d))) {
    d.setUTCDate(d.getUTCDate() + 1);
    d = withTime(d, startHour, 0);
  }
  
  const workStart = withTime(d, startHour, 0);
  const workEnd = config.busy_period_active 
    ? withTime(d, config.busy_end_hour, config.busy_end_minute)
    : withTime(d, config.work_end_hour, config.work_end_minute);
    
  if (d < workStart) return workStart;
  if (d > workEnd) {
    const n = new Date(d);
    n.setUTCDate(n.getUTCDate() + 1);
    return nextWorkingStart(withTime(n, startHour, 0));
  }
  return d;
}

async function calculateDailyWorkingMinutes(): Promise<number> {
  const config = await getWorkingHoursConfig();
  
  if (config.busy_period_active) {
    const busyHours = config.busy_end_hour - config.busy_start_hour;
    const busyMinutes = config.busy_end_minute;
    return busyHours * 60 + busyMinutes;
  }
  
  const normalHours = config.work_end_hour - config.work_start_hour;
  const normalMinutes = config.work_end_minute;
  return normalHours * 60 + normalMinutes;
}

async function addWorkingMinutesWithCapacity(start: Date, minutes: number): Promise<Date> {
  const config = await getWorkingHoursConfig();
  const dailyCapacityMinutes = await calculateDailyWorkingMinutes();
  
  let remaining = minutes;
  let current = await nextWorkingStart(start);
  
  while (remaining > 0) {
    const endHour = config.busy_period_active ? config.busy_end_hour : config.work_end_hour;
    const endMinute = config.busy_period_active ? config.busy_end_minute : config.work_end_minute;
    const dayEnd = withTime(current, endHour, endMinute);
    
    const availableInDay = Math.max(0, Math.floor((dayEnd.getTime() - current.getTime()) / 60000));
    
    if (remaining <= availableInDay) {
      return new Date(current.getTime() + remaining * 60000);
    }
    
    // Continue to next working day
    remaining -= availableInDay;
    const nextDay = new Date(current);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    current = await nextWorkingStart(nextDay);
  }
  
  return current;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  try {
    console.log("🔄 [TENTATIVE DUE DATES] Starting recalculation with multi-day support");
    
    // Midnight baseline with working hours consideration
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    // Find jobs waiting in Proof stages without approval
    const { data: pendingProofStages, error } = await supabase
      .from("job_stage_instances")
      .select("job_id, job_table_name, production_stages:production_stage_id(name), proof_approved_manually_at")
      .is("proof_approved_manually_at", null)
      .eq("status", "pending");

    if (error) {
      console.error("Fetch pending proof stages error", error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const uniqueJobs = new Map<string, { job_id: UUID; job_table_name: string }>();
    for (const row of pendingProofStages ?? []) {
      const name = (row as any).production_stages?.name?.toLowerCase?.() ?? "";
      if (name.includes("proof")) {
        uniqueJobs.set((row as any).job_id, { 
          job_id: (row as any).job_id, 
          job_table_name: (row as any).job_table_name 
        });
      }
    }

    const results: Array<{ job_id: UUID; tentative_due_date: string }> = [];
    console.log(`📊 Processing ${uniqueJobs.size} jobs for tentative due date calculation`);

    for (const { job_id, job_table_name } of uniqueJobs.values()) {
      console.log(`\n🔍 Processing job ${job_id}`);
      
      // Fetch stages for this job (pending/active) with workflow information
      const { data: stages } = await supabase
        .from("job_stage_instances")
        .select(`
          id, 
          production_stage_id, 
          stage_order, 
          status, 
          estimated_duration_minutes,
          part_assignment,
          dependency_group
        `)
        .eq("job_id", job_id)
        .eq("job_table_name", job_table_name)
        .in("status", ["pending", "active"])
        .order("stage_order", { ascending: true });

      if (!stages || stages.length === 0) {
        console.log(`⚠️ No stages found for job ${job_id}`);
        continue;
      }

      // Simulate workflow-aware scheduling with multi-day capacity
      const workflowPaths: Record<string, any[]> = {};
      const convergenceStages: any[] = [];

      // Group stages by workflow path
      for (const stage of stages) {
        const partAssignment = stage.part_assignment || 'main';
        if (partAssignment === 'both') {
          convergenceStages.push(stage);
        } else {
          if (!workflowPaths[partAssignment]) {
            workflowPaths[partAssignment] = [];
          }
          workflowPaths[partAssignment].push(stage);
        }
      }

      // Sort each path by stage_order
      Object.values(workflowPaths).forEach(path => {
        path.sort((a, b) => a.stage_order - b.stage_order);
      });
      convergenceStages.sort((a, b) => a.stage_order - b.stage_order);

      const pathCompletionTimes: Record<string, Date> = {};
      let simulationPointer = await nextWorkingStart(midnight);

      // Simulate parallel paths
      for (const [pathName, pathStages] of Object.entries(workflowPaths)) {
        console.log(`📋 Simulating path: ${pathName} (${pathStages.length} stages)`);
        
        let pathPointer = simulationPointer;
        for (const stage of pathStages) {
          const minutes = stage.estimated_duration_minutes ?? 60;
          console.log(`  ⏱️ Stage ${stage.production_stage_id}: ${minutes} min`);
          
          // Get simulated queue end time for this stage
          const { data: queueData } = await supabase.rpc('get_stage_queue_end_time', {
            p_stage_id: stage.production_stage_id,
            p_date: toDateOnly(pathPointer)
          });
          
          const queueEnd = queueData ? new Date(queueData) : pathPointer;
          const stageStart = await nextWorkingStart(new Date(Math.max(pathPointer.getTime(), queueEnd.getTime())));
          const stageEnd = await addWorkingMinutesWithCapacity(stageStart, minutes);
          
          console.log(`    🕐 ${stageStart.toISOString()} → ${stageEnd.toISOString()}`);
          
          pathPointer = stageEnd;
        }
        pathCompletionTimes[pathName] = pathPointer;
        console.log(`✅ Path ${pathName} completes at: ${pathPointer.toISOString()}`);
      }

      // Simulate convergence stages
      let finalCompletion = simulationPointer;
      if (Object.keys(pathCompletionTimes).length > 0) {
        const latestPathCompletion = Object.values(pathCompletionTimes).reduce(
          (latest, current) => current > latest ? current : latest,
          new Date()
        );
        finalCompletion = latestPathCompletion;
      }

      if (convergenceStages.length > 0) {
        console.log(`🔗 Simulating convergence stages (${convergenceStages.length})`);
        
        let convergencePointer = finalCompletion;
        for (const stage of convergenceStages) {
          const minutes = stage.estimated_duration_minutes ?? 60;
          console.log(`  ⏱️ Convergence stage ${stage.production_stage_id}: ${minutes} min`);
          
          const { data: queueData } = await supabase.rpc('get_stage_queue_end_time', {
            p_stage_id: stage.production_stage_id,
            p_date: toDateOnly(convergencePointer)
          });
          
          const queueEnd = queueData ? new Date(queueData) : convergencePointer;
          const stageStart = await nextWorkingStart(new Date(Math.max(convergencePointer.getTime(), queueEnd.getTime())));
          const stageEnd = await addWorkingMinutesWithCapacity(stageStart, minutes);
          
          console.log(`    🕐 ${stageStart.toISOString()} → ${stageEnd.toISOString()}`);
          
          convergencePointer = stageEnd;
        }
        finalCompletion = convergencePointer;
      }

      if (finalCompletion) {
        const dailyCapacity = await calculateDailyWorkingMinutes();
        const bufferEnd = await addWorkingMinutesWithCapacity(finalCompletion, dailyCapacity); // +1 working day buffer
        const tentative = toDateOnly(bufferEnd);
        
        console.log(`📅 Job ${job_id}: Final completion ${finalCompletion.toISOString()} → Tentative due date ${tentative}`);
        
        const { error: upErr } = await supabase
          .from("production_jobs")
          .update({ 
            tentative_due_date: tentative, 
            updated_at: new Date().toISOString() 
          })
          .eq("id", job_id);
          
        if (!upErr) {
          results.push({ job_id, tentative_due_date: tentative });
        } else {
          console.error("Failed updating tentative due date", upErr);
        }
      }
    }

    console.log(`✅ [TENTATIVE DUE DATES] Successfully updated ${results.length} jobs`);

    return new Response(JSON.stringify({ 
      ok: true, 
      count: results.length, 
      results 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
    
  } catch (e: any) {
    console.error("[recalc-tentative-due-dates] error", e);
    return new Response(JSON.stringify({ 
      error: e?.message ?? "Unknown error" 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});