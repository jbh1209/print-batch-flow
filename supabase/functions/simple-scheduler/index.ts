import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get all stages for this job, ordered by stage_order
    const { data: stages, error: stagesError } = await supabase
      .from('job_stage_instances')
      .select('id, production_stage_id, stage_order, estimated_duration_minutes')
      .eq('job_id', job_id)
      .eq('job_table_name', job_table_name)
      .order('stage_order', { ascending: true });

    if (stagesError) {
      throw new Error(`Failed to fetch job stages: ${stagesError.message}`);
    }

    if (!stages || stages.length === 0) {
      console.log('⚠️ No stages found for job');
      return new Response(
        JSON.stringify({ success: false, message: 'No stages found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${stages.length} stages to schedule`);

    // Start scheduling from tomorrow or next working day (never in the past)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // Start at 8 AM
    
    let currentContainerDate = getNextWorkingDay(tomorrow);
    
    // Find actual next available container by checking existing schedules
    async function findNextAvailableContainer(fromDate: Date): Promise<{ date: Date, usedMinutes: number }> {
      const checkDate = new Date(fromDate);
      
      while (true) {
        // Skip weekends
        if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
          checkDate.setDate(checkDate.getDate() + 1);
          continue;
        }
        
        // Query existing scheduled jobs for this date
        const startOfDay = new Date(checkDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(checkDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data: existingJobs, error } = await supabase
          .from('job_stage_instances')
          .select('scheduled_minutes')
          .gte('scheduled_start_at', startOfDay.toISOString())
          .lt('scheduled_start_at', endOfDay.toISOString())
          .not('scheduled_minutes', 'is', null);
        
        if (error) {
          console.warn(`⚠️ Error checking existing schedules: ${error.message}`);
          // If we can't check, assume no usage
          return { date: new Date(checkDate), usedMinutes: 0 };
        }
        
        const usedMinutes = existingJobs?.reduce((sum, job) => sum + (job.scheduled_minutes || 0), 0) || 0;
        console.log(`📅 ${checkDate.toDateString()}: ${usedMinutes} minutes already scheduled`);
        
        if (usedMinutes < 480) { // 8 hours = 480 minutes capacity
          return { date: new Date(checkDate), usedMinutes };
        }
        
        // This day is full, try next day
        checkDate.setDate(checkDate.getDate() + 1);
      }
    }
    
    let containerInfo = await findNextAvailableContainer(currentContainerDate);
    currentContainerDate = containerInfo.date;
    let currentContainerMinutes = containerInfo.usedMinutes;

    for (const stage of stages) {
      const durationMinutes = stage.estimated_duration_minutes || 60; // Default 1 hour
      
      // Check if stage fits in current container (480 minutes = 8 hours)
      if (currentContainerMinutes + durationMinutes <= 480) {
        // Fits in current container
        const startTime = new Date(currentContainerDate);
        startTime.setMinutes(startTime.getMinutes() + currentContainerMinutes);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);

        // Update stage with schedule
        await supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: startTime.toISOString(),
            scheduled_end_at: endTime.toISOString(),
            scheduled_minutes: durationMinutes
          })
          .eq('id', stage.id);

        currentContainerMinutes += durationMinutes;
        console.log(`✅ Scheduled stage ${stage.stage_order}: ${startTime.toTimeString().slice(0,5)}-${endTime.toTimeString().slice(0,5)}`);
      } else {
        // Move to next available container (next working day with capacity)
        const nextDay = new Date(currentContainerDate);
        nextDay.setDate(nextDay.getDate() + 1);
        containerInfo = await findNextAvailableContainer(nextDay);
        currentContainerDate = containerInfo.date;
        currentContainerMinutes = containerInfo.usedMinutes;

        const startTime = new Date(currentContainerDate);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);

        // Update stage with schedule
        await supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: startTime.toISOString(),
            scheduled_end_at: endTime.toISOString(),
            scheduled_minutes: durationMinutes
          })
          .eq('id', stage.id);

        currentContainerMinutes = durationMinutes;
        console.log(`✅ Scheduled stage ${stage.stage_order} (next day): ${startTime.toTimeString().slice(0,5)}-${endTime.toTimeString().slice(0,5)}`);
      }
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
    console.error('❌ Simple scheduler error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function getNextWorkingDay(currentDate: Date): Date {
  const nextDay = new Date(currentDate);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(8, 0, 0, 0); // Reset to 8 AM

  // Skip weekends (Saturday = 6, Sunday = 0)
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
}