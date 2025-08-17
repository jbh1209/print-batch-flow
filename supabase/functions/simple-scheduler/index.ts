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

    // FIXED: Start from today in UTC, never schedule in the past
    const nowUTC = new Date();
    const todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate(), 8, 0, 0, 0));
    const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000); // Add 1 day in milliseconds
    
    // Start from tomorrow (never today to avoid past scheduling)
    const startDate = new Date(tomorrowUTC);
    console.log(`🕐 Scheduling starts from: ${startDate.toISOString()}`);
    
    // FIXED: Find next available container with proper capacity checking
    async function findNextAvailableContainer(fromDateUTC: Date): Promise<{ date: Date, usedMinutes: number }> {
      let checkDate = new Date(fromDateUTC); // Create immutable copy
      
      while (true) {
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (checkDate.getUTCDay() === 0 || checkDate.getUTCDay() === 6) {
          checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
          continue;
        }
        
        console.log(`🔍 Checking capacity for: ${checkDate.toISOString().split('T')[0]}`);
        
        // Query existing scheduled jobs for this exact date
        const dayStart = new Date(Date.UTC(checkDate.getUTCFullYear(), checkDate.getUTCMonth(), checkDate.getUTCDate(), 0, 0, 0, 0));
        const dayEnd = new Date(Date.UTC(checkDate.getUTCFullYear(), checkDate.getUTCMonth(), checkDate.getUTCDate(), 23, 59, 59, 999));
        
        const { data: existingJobs, error } = await supabase
          .from('job_stage_instances')
          .select('scheduled_minutes')
          .gte('scheduled_start_at', dayStart.toISOString())
          .lt('scheduled_start_at', dayEnd.toISOString())
          .not('scheduled_minutes', 'is', null);
        
        if (error) {
          console.warn(`⚠️ Error checking schedules for ${checkDate.toISOString().split('T')[0]}: ${error.message}`);
          return { date: new Date(checkDate), usedMinutes: 0 };
        }
        
        const usedMinutes = existingJobs?.reduce((sum, job) => sum + (job.scheduled_minutes || 0), 0) || 0;
        const availableMinutes = 480 - usedMinutes; // 8 hours = 480 minutes total capacity
        
        console.log(`📊 ${checkDate.toISOString().split('T')[0]}: ${usedMinutes}/480 minutes used, ${availableMinutes} available`);
        
        if (availableMinutes > 0) {
          return { date: new Date(checkDate), usedMinutes };
        }
        
        // This day is full, try next day
        checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    
    // Find the first available container
    let containerInfo = await findNextAvailableContainer(startDate);
    let currentContainerDate = containerInfo.date;
    let currentContainerMinutes = containerInfo.usedMinutes;
    
    console.log(`📦 Starting container: ${currentContainerDate.toISOString().split('T')[0]} with ${currentContainerMinutes} minutes already used`);

    for (const stage of stages) {
      const durationMinutes = stage.estimated_duration_minutes || 60; // Default 1 hour
      
      console.log(`🔧 Processing stage ${stage.stage_order}: needs ${durationMinutes} minutes`);
      
      // Check if stage fits in current container (480 minutes = 8 hours total capacity)
      const remainingCapacity = 480 - currentContainerMinutes;
      console.log(`📦 Current container has ${remainingCapacity} minutes remaining (${currentContainerMinutes}/480 used)`);
      
      if (durationMinutes <= remainingCapacity) {
        // FIXED: Schedule AFTER existing work in container
        const containerStartUTC = new Date(Date.UTC(
          currentContainerDate.getUTCFullYear(), 
          currentContainerDate.getUTCMonth(), 
          currentContainerDate.getUTCDate(), 
          8, 0, 0, 0
        ));
        
        // Start time = container start + existing minutes
        const startTime = new Date(containerStartUTC.getTime() + (currentContainerMinutes * 60 * 1000));
        const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
        
        console.log(`⏰ Scheduling in current container: ${startTime.toISOString()} to ${endTime.toISOString()}`);

        // Update stage with schedule
        await supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: startTime.toISOString(),
            scheduled_end_at: endTime.toISOString(),
            scheduled_minutes: durationMinutes
          })
          .eq('id', stage.id);

        // Update container usage
        currentContainerMinutes += durationMinutes;
        console.log(`✅ Scheduled stage ${stage.stage_order} in current container: ${startTime.toISOString().split('T')[1].slice(0,5)}-${endTime.toISOString().split('T')[1].slice(0,5)} (container now ${currentContainerMinutes}/480 minutes)`);
      } else {
        // FIXED: Move to next available container with proper date increment
        console.log(`⏭️ Stage doesn't fit, finding next container...`);
        const nextSearchDate = new Date(currentContainerDate.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
        containerInfo = await findNextAvailableContainer(nextSearchDate);
        currentContainerDate = containerInfo.date;
        currentContainerMinutes = containerInfo.usedMinutes;
        
        console.log(`📦 New container: ${currentContainerDate.toISOString().split('T')[0]} with ${currentContainerMinutes} minutes used`);

        // FIXED: Schedule AFTER existing work in new container  
        const containerStartUTC = new Date(Date.UTC(
          currentContainerDate.getUTCFullYear(), 
          currentContainerDate.getUTCMonth(), 
          currentContainerDate.getUTCDate(), 
          8, 0, 0, 0
        ));
        
        const startTime = new Date(containerStartUTC.getTime() + (currentContainerMinutes * 60 * 1000));
        const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
        
        console.log(`⏰ Scheduling in new container: ${startTime.toISOString()} to ${endTime.toISOString()}`);

        // Update stage with schedule
        await supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: startTime.toISOString(),
            scheduled_end_at: endTime.toISOString(),
            scheduled_minutes: durationMinutes
          })
          .eq('id', stage.id);

        // Update container usage
        currentContainerMinutes += durationMinutes;
        console.log(`✅ Scheduled stage ${stage.stage_order} in new container: ${startTime.toISOString().split('T')[1].slice(0,5)}-${endTime.toISOString().split('T')[1].slice(0,5)} (container now ${currentContainerMinutes}/480 minutes)`);
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

// REMOVED: This function had the double increment bug and is no longer needed
// The scheduling logic now uses explicit UTC date arithmetic instead