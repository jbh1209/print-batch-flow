import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface WorkingHoursConfig {
  work_start_hour: number;
  work_end_hour: number;
  work_end_minute: number;
  busy_period_active: boolean;
  busy_start_hour: number;
  busy_end_hour: number;
  busy_end_minute: number;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
);

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

function toStartOfDay(dateStr: string, hour = 8, minute = 0) {
  const d = new Date(`${dateStr}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00.000Z`);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

async function isHoliday(date: Date): Promise<boolean> {
  try {
    const dateStr = date.toISOString().split("T")[0];
    const { data, error } = await supabase.rpc("is_public_holiday", { 
      check_date: dateStr 
    });
    if (error) return false;
    return Boolean(data);
  } catch { 
    return false; 
  }
}

async function isWorkingDay(date: Date): Promise<boolean> {
  if (isWeekend(date)) return false;
  return !(await isHoliday(date));
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

async function getUsedMinutes(stageId: string, dayIso: string): Promise<number> {
  const config = await getWorkingHoursConfig();
  const startHour = config.busy_period_active ? config.busy_start_hour : config.work_start_hour;
  
  const dayStart = toStartOfDay(dayIso, startHour, 0).toISOString();
  const nextDay = addMinutes(toStartOfDay(dayIso, startHour, 0), 24 * 60).toISOString();
  
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
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "stage_instance_id and target_date are required" 
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 400 
      });
    }

    console.log(`🔧 [MANUAL RESCHEDULE] Rescheduling stage ${stage_instance_id} to ${target_date}`);

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

    console.log(`📊 Stage details: ${stageId}, Duration: ${totalMinutes} minutes`);

    // Get working hours configuration
    const config = await getWorkingHoursConfig();
    const capMinutes = await calculateDailyWorkingMinutes();
    
    console.log(`⚙️ Working hours: ${config.work_start_hour}:${config.work_end_minute.toString().padStart(2, '0')} - ${config.work_end_hour}:${config.work_end_minute.toString().padStart(2, '0')}`);
    if (config.busy_period_active) {
      console.log(`🚨 Busy period active: ${config.busy_start_hour}:00 - ${config.busy_end_hour}:${config.busy_end_minute.toString().padStart(2, '0')}`);
    }

    // Compute start based on existing load of day
    let day = new Date(`${target_date}T00:00:00.000Z`);
    
    // Move to Monday-Friday if weekend
    while (!await isWorkingDay(day)) {
      day = addMinutes(day, 24 * 60);
    }
    
    const dayStr = day.toISOString().slice(0, 10);
    const startHour = config.busy_period_active ? config.busy_start_hour : config.work_start_hour;
    const endHour = config.busy_period_active ? config.busy_end_hour : config.work_end_hour;
    const endMinute = config.busy_period_active ? config.busy_end_minute : config.work_end_minute;
    
    const dayStart = toStartOfDay(dayStr, startHour, 0);
    const dayEnd = toStartOfDay(dayStr, endHour, endMinute);

    console.log(`📅 Target day: ${dayStr}, Working window: ${dayStart.toISOString()} - ${dayEnd.toISOString()}`);

    const used = await getUsedMinutes(stageId, dayStr);
    let cursor = addMinutes(dayStart, Math.min(used, capMinutes));
    
    console.log(`📈 Stage capacity: ${capMinutes} min, Used: ${used} min, Starting at: ${cursor.toISOString()}`);

    // If overflows the day, roll to next working day
    while (cursor >= dayEnd) {
      day = addMinutes(day, 24 * 60);
      while (!await isWorkingDay(day)) {
        day = addMinutes(day, 24 * 60);
      }
      const ndStr = day.toISOString().slice(0, 10);
      const ndStart = toStartOfDay(ndStr, startHour, 0);
      cursor = ndStart;
      console.log(`🔄 Overflow to next working day: ${ndStr}, Starting at: ${cursor.toISOString()}`);
    }

    // Compute end time with multi-day support
    let remaining = totalMinutes;
    let current = new Date(cursor);
    const splits: Array<{start: Date, end: Date, minutes: number}> = [];

    while (remaining > 0) {
      const curDayStr = current.toISOString().slice(0, 10);
      const curStart = toStartOfDay(curDayStr, startHour, 0);
      const curEnd = toStartOfDay(curDayStr, endHour, endMinute);

      // Determine free minutes today from current position to curEnd
      const freeToday = Math.max(0, Math.round((curEnd.getTime() - current.getTime()) / 60000));
      
      if (freeToday >= remaining) {
        // Job completes today
        const endTime = addMinutes(current, remaining);
        splits.push({
          start: new Date(current),
          end: endTime,
          minutes: remaining
        });
        current = endTime;
        remaining = 0;
        console.log(`✅ Job completes today: ${splits[splits.length-1].start.toISOString()} → ${splits[splits.length-1].end.toISOString()} (${splits[splits.length-1].minutes} min)`);
      } else {
        // Job continues tomorrow
        splits.push({
          start: new Date(current),
          end: new Date(curEnd),
          minutes: freeToday
        });
        remaining -= freeToday;
        console.log(`⏭️ Partial completion: ${splits[splits.length-1].start.toISOString()} → ${splits[splits.length-1].end.toISOString()} (${splits[splits.length-1].minutes} min), ${remaining} min remaining`);
        
        // Move to next working day start
        let next = addMinutes(curEnd, 15); // small gap
        while (!await isWorkingDay(next)) {
          next = addMinutes(next, 24 * 60);
        }
        current = toStartOfDay(next.toISOString().slice(0,10), startHour, 0);
      }
    }

    const scheduled_start_at = cursor.toISOString();
    const scheduled_end_at = current.toISOString();

    console.log(`📋 Final schedule: ${scheduled_start_at} → ${scheduled_end_at} (${splits.length} day splits)`);

    // Update the main stage instance
    const { error: upErr } = await supabase
      .from("job_stage_instances")
      .update({
        scheduled_start_at,
        scheduled_end_at,
        scheduled_minutes: totalMinutes,
        schedule_status: 'scheduled',
        split_sequence: 1,
        total_splits: splits.length,
        daily_completion_minutes: splits[0]?.minutes || totalMinutes,
        split_status: splits.length > 1 ? 'partial' : 'complete',
        updated_at: new Date().toISOString(),
      })
      .eq("id", stage_instance_id);

    if (upErr) throw upErr;

    // Create continuation instances for multi-day jobs
    if (splits.length > 1) {
      for (let i = 1; i < splits.length; i++) {
        const split = splits[i];
        await supabase
          .from("job_stage_instances")
          .insert({
            job_id: (jsi as any).job_id,
            job_table_name: job_table_name || 'production_jobs',
            category_id: (jsi as any).category_id,
            production_stage_id: stageId,
            stage_order: (jsi as any).stage_order,
            status: 'pending',
            scheduled_start_at: split.start.toISOString(),
            scheduled_end_at: split.end.toISOString(),
            scheduled_minutes: split.minutes,
            estimated_duration_minutes: split.minutes,
            schedule_status: 'scheduled',
            split_sequence: i + 1,
            total_splits: splits.length,
            parent_split_id: stage_instance_id,
            remaining_minutes: totalMinutes - splits.slice(0, i + 1).reduce((sum, s) => sum + s.minutes, 0),
            daily_completion_minutes: split.minutes,
            split_status: 'continuation'
          });
        
        console.log(`➕ Created continuation split ${i + 1}: ${split.start.toISOString()} → ${split.end.toISOString()} (${split.minutes} min)`);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      scheduled_start_at, 
      scheduled_end_at,
      splits: splits.length,
      total_minutes: totalMinutes
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (err: any) {
    console.error("❌ [MANUAL RESCHEDULE] Error:", err);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: err.message || "Unknown error" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}

Deno.serve(handler);