import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { job_id, job_table_name = 'production_jobs' } = await req.json();
    console.log(`🚀 Simple Scheduler starting for job ${job_id}`);

    // Get stages for this job
    const { data: stages, error: stagesError } = await supabase
      .from('job_stage_instances')
      .select('id, stage_order, estimated_duration_minutes')
      .eq('job_id', job_id)
      .eq('job_table_name', job_table_name)
      .order('stage_order', { ascending: true });

    if (stagesError) {
      throw new Error(`Failed to fetch job stages: ${stagesError.message}`);
    }

    if (!stages || stages.length === 0) {
      console.log('⚠️ No stages found');
      return new Response(
        JSON.stringify({ success: false, message: 'No stages found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${stages.length} stages to schedule`);

    // Simple date logic: start from today UTC, format as YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Today is: ${today}`);

    // Find next available working day with capacity
    async function findNextAvailableWorkingDay(startDate: string, requiredMinutes: number): Promise<{ date: string, usedMinutes: number }> {
      let checkDate = new Date(startDate + 'T00:00:00.000Z');
      
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        
        // Skip weekends
        const dayOfWeek = checkDate.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          checkDate.setUTCDate(checkDate.getUTCDate() + 1);
          continue;
        }
        
        console.log(`🔍 Checking ${dateStr} for ${requiredMinutes} minutes`);
        
        // Query scheduled minutes for this date
        const { data: existingJobs, error } = await supabase
          .from('job_stage_instances')
          .select('scheduled_minutes')
          .gte('scheduled_start_at', dateStr + 'T00:00:00.000Z')
          .lt('scheduled_start_at', dateStr + 'T23:59:59.999Z')
          .not('scheduled_minutes', 'is', null);
        
        if (error) {
          console.warn(`⚠️ Error checking ${dateStr}: ${error.message}`);
          return { date: dateStr, usedMinutes: 0 };
        }
        
        const usedMinutes = existingJobs?.reduce((sum, job) => sum + (job.scheduled_minutes || 0), 0) || 0;
        const remainingMinutes = 480 - usedMinutes; // 8-hour shifts
        
        console.log(`📊 ${dateStr}: ${usedMinutes}/480 minutes used, ${remainingMinutes} available`);
        
        if (remainingMinutes >= requiredMinutes) {
          return { date: dateStr, usedMinutes };
        }
        
        // Try next day
        checkDate.setUTCDate(checkDate.getUTCDate() + 1);
      }
    }

    // Schedule each stage sequentially
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const durationMinutes = stage.estimated_duration_minutes || 60;
      
      console.log(`🔧 Scheduling stage ${stage.stage_order}: ${durationMinutes} minutes`);
      
      // Find next available day for this stage
      const { date: scheduleDate, usedMinutes } = await findNextAvailableWorkingDay(today, durationMinutes);
      
      // Calculate start time: shift starts at 08:00 UTC + existing work
      const startTime = new Date(scheduleDate + 'T08:00:00.000Z');
      startTime.setUTCMinutes(startTime.getUTCMinutes() + usedMinutes);
      
      const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
      
      console.log(`⏰ Scheduling on ${scheduleDate}: ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      // Validate we're not scheduling in the past
      const now = new Date();
      if (startTime < now) {
        console.error(`❌ PAST SCHEDULING DETECTED: ${startTime.toISOString()} is before ${now.toISOString()}`);
        throw new Error('Cannot schedule in the past');
      }
      
      // Update the stage
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: startTime.toISOString(),
          scheduled_end_at: endTime.toISOString(),
          scheduled_minutes: durationMinutes
        })
        .eq('id', stage.id);
      
      if (updateError) {
        throw new Error(`Failed to update stage ${stage.id}: ${updateError.message}`);
      }
      
      console.log(`✅ Scheduled stage ${stage.stage_order} on ${scheduleDate} from ${startTime.toISOString().split('T')[1].slice(0,5)} to ${endTime.toISOString().split('T')[1].slice(0,5)}`);
    }

    console.log(`🎯 Successfully scheduled ${stages.length} stages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled_stages: stages.length,
        job_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Scheduler error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});