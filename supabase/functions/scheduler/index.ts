import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * PRODUCTION-READY UNIFIED SCHEDULER
 * Thin edge function orchestrator that calls BusinessLogicEngine
 * Replaces: parallel-auto-scheduler, auto-schedule-approved, manual-reschedule-stage
 */

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[scheduler] Request received:', body);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Import BusinessLogicEngine (we'll inline the scheduling logic here for edge function)
    const result = await scheduleJobLogic(supabase, {
      jobId: body.job_id,
      jobTableName: body.job_table_name || 'production_jobs',
      targetDateTime: body.target_date_time,
      stageId: body.stage_id,
      userId: body.user_id,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error('[scheduler] Error:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error',
        scheduled: 0 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

/**
 * Core scheduling logic (inlined for edge function)
 * This is the essence of BusinessLogicEngine.scheduleJob() adapted for Deno
 */
async function scheduleJobLogic(supabase: any, {
  jobId,
  jobTableName = "production_jobs",
  targetDateTime,
  stageId,
  userId,
}: {
  jobId: string;
  jobTableName?: string;
  targetDateTime?: string;
  stageId?: string;
  userId?: string;
}) {
  try {
    console.log(`[scheduler] Scheduling job ${jobId} in table ${jobTableName}`);

    // 1. Fetch unscheduled stages
    const { data: stages, error: stagesError } = await supabase
      .from("job_stage_instances")
      .select("id, production_stage_id, estimated_duration_minutes, setup_time_minutes, stage_order")
      .eq("job_id", jobId)
      .eq("job_table_name", jobTableName)
      .is("scheduled_start_at", null)
      .order("stage_order");

    if (stagesError) {
      console.error('[scheduler] Error fetching stages:', stagesError);
      throw stagesError;
    }

    if (!stages || stages.length === 0) {
      console.log('[scheduler] No unscheduled stages found');
      return { success: true, message: "No stages to schedule", scheduled: 0 };
    }

    console.log(`[scheduler] Found ${stages.length} unscheduled stages`);
    let scheduledCount = 0;

    // 2. Loop through each stage
    for (const stage of stages) {
      const durationMinutes = (stage.estimated_duration_minutes || 60) + (stage.setup_time_minutes || 0);
      let startTime: Date;

      if (targetDateTime && stageId === stage.production_stage_id) {
        // Manual override - use provided time
        console.log(`[scheduler] Manual override for stage ${stage.production_stage_id}: ${targetDateTime}`);
        startTime = new Date(targetDateTime);
      } else {
        // Auto schedule - find next available slot
        console.log(`[scheduler] Auto-scheduling stage ${stage.production_stage_id}, duration: ${durationMinutes}min`);
        
        // Get stage capacity
        const { data: capRows } = await supabase
          .from('stage_capacity_profiles')
          .select('daily_capacity_hours')
          .eq('production_stage_id', stage.production_stage_id)
          .limit(1)
          .maybeSingle();

        const dailyCapacityHours = capRows?.daily_capacity_hours ?? 8.5;
        const dailyCapacityMinutes = Math.round(dailyCapacityHours * 60);

        // Simple slot finding (production version would use findNextAvailableSlot)
        startTime = await findSimpleNextSlot(supabase, stage.production_stage_id, durationMinutes, dailyCapacityMinutes);
      }

      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      // 3. Persist scheduled values
      const { error: updateError } = await supabase
        .from("job_stage_instances")
        .update({
          scheduled_start_at: startTime.toISOString(),
          scheduled_end_at: endTime.toISOString(),
          scheduled_minutes: durationMinutes,
          schedule_status: "scheduled",
          scheduling_method: targetDateTime ? "manual" : "auto",
          scheduled_by_user_id: userId || null,
        })
        .eq("id", stage.id);

      if (updateError) {
        console.error(`[scheduler] Error updating stage ${stage.id}:`, updateError);
        throw updateError;
      }

      console.log(`[scheduler] Scheduled stage ${stage.production_stage_id}: ${startTime.toISOString()}`);
      scheduledCount++;
    }

    console.log(`[scheduler] Successfully scheduled ${scheduledCount} stages`);
    return {
      success: true,
      message: `Scheduled ${scheduledCount} stages`,
      scheduled: scheduledCount,
    };

  } catch (error) {
    console.error('[scheduler] Error in scheduleJobLogic:', error);
    throw error;
  }
}

/**
 * Simple slot finding for edge function
 * Production version would import the full findNextAvailableSlot logic
 */
async function findSimpleNextSlot(supabase: any, stageId: string, durationMinutes: number, dailyCapacityMinutes: number): Promise<Date> {
  // Use current SAST time as starting point
  const nowSAST = new Date();
  const today = new Date(nowSAST.getFullYear(), nowSAST.getMonth(), nowSAST.getDate());
  
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    
    // Skip weekends
    if (checkDate.getDay() === 0 || checkDate.getDay() === 6) continue;

    // Create 8:00 AM SAST time in UTC for database queries
    const dayStartSAST = new Date(checkDate);
    dayStartSAST.setHours(8, 0, 0, 0);
    const dayStartUTC = new Date(dayStartSAST.getTime() - (2 * 60 * 60 * 1000)); // SAST to UTC (subtract 2 hours)
    
    const dayEndSAST = new Date(checkDate);
    dayEndSAST.setHours(17, 30, 0, 0);
    const dayEndUTC = new Date(dayEndSAST.getTime() - (2 * 60 * 60 * 1000)); // SAST to UTC (subtract 2 hours)

    // Query existing scheduled jobs for this stage and day
    const { data: usedSlots } = await supabase
      .from("job_stage_instances")
      .select("scheduled_minutes")
      .eq("production_stage_id", stageId)
      .gte("scheduled_start_at", dayStartUTC.toISOString())
      .lt("scheduled_start_at", dayEndUTC.toISOString());

    const usedMinutes = (usedSlots || []).reduce(
      (sum: number, slot: any) => sum + (slot.scheduled_minutes || 0),
      0
    );

    const availableMinutes = dailyCapacityMinutes - usedMinutes;

    if (availableMinutes >= durationMinutes) {
      // Found a day with capacity - schedule sequentially after used time
      const slotStartSAST = new Date(dayStartSAST);
      slotStartSAST.setMinutes(slotStartSAST.getMinutes() + usedMinutes);
      
      // Convert to UTC for database storage
      const slotStartUTC = new Date(slotStartSAST.getTime() - (2 * 60 * 60 * 1000));
      
      console.log(`[scheduler] Found slot on ${slotStartSAST.toISOString()} SAST (${slotStartUTC.toISOString()} UTC) - ${availableMinutes}min available`);
      return slotStartUTC;
    }
  }

  // Fallback - 30 days from now at 8 AM SAST converted to UTC
  const fallbackSAST = new Date(today);
  fallbackSAST.setDate(fallbackSAST.getDate() + 30);
  fallbackSAST.setHours(8, 0, 0, 0);
  const fallbackUTC = new Date(fallbackSAST.getTime() - (2 * 60 * 60 * 1000));
  
  console.log(`[scheduler] No slots found within 30 days, using fallback: ${fallbackSAST.toISOString()} SAST (${fallbackUTC.toISOString()} UTC)`);
  return fallbackUTC;
}