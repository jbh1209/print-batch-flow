/**
 * ULTRA SIMPLE SCHEDULER - Dead simple approach
 * Just get pending stages, schedule them one after another starting at 8AM tomorrow
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 ULTRA SIMPLE SCHEDULER STARTING...');
    
    // STEP 1: Clear all existing scheduled data
    console.log('💥 Clearing existing schedules...');
    await supabase
      .from('job_stage_instances')
      .update({
        scheduled_start_at: null,
        scheduled_end_at: null,
        scheduled_minutes: null,
        schedule_status: 'unscheduled'
      })
      .not('id', 'is', null);
    
    // STEP 2: Get all pending job stage instances
    console.log('📋 Getting pending job stage instances...');
    const { data: pendingStages, error: stageError } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        job_id,
        production_stage_id,
        estimated_duration_minutes,
        production_stages!inner(id, name),
        production_jobs!inner(id, wo_no, proof_approved_at, status)
      `)
      .eq('status', 'pending')
      .neq('production_jobs.status', 'Completed')
      .not('production_jobs.proof_approved_at', 'is', null)
      .order('production_jobs.proof_approved_at', { ascending: true });

    if (stageError) {
      console.error('❌ Error fetching stages:', stageError);
      throw stageError;
    }

    if (!pendingStages || pendingStages.length === 0) {
      console.log('✅ No pending stages found');
      return new Response(
        JSON.stringify({ message: 'No pending stages to schedule', scheduled_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Found ${pendingStages.length} pending stages`);

    // STEP 3: Filter out unwanted stages (DTP, Proof, Batch Allocation)
    const filteredStages = pendingStages.filter(stage => {
      const stageName = stage.production_stages?.name?.toLowerCase() || '';
      return !stageName.includes('dtp') && 
             !stageName.includes('proof') && 
             !stageName.includes('batch allocation');
    });

    console.log(`🔍 After filtering: ${filteredStages.length} stages to schedule`);

    if (filteredStages.length === 0) {
      console.log('✅ No stages left after filtering');
      return new Response(
        JSON.stringify({ message: 'No stages to schedule after filtering', scheduled_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 4: Start scheduling from tomorrow 8:00 AM UTC
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(8, 0, 0, 0);
    
    // Skip weekends
    while (tomorrow.getUTCDay() === 0 || tomorrow.getUTCDay() === 6) {
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    }
    
    console.log(`🎯 Starting schedule from: ${tomorrow.toISOString()}`);
    
    let currentTime = new Date(tomorrow);
    let scheduledCount = 0;
    
    // STEP 5: Schedule each stage sequentially
    for (const stage of filteredStages) {
      const durationMinutes = stage.estimated_duration_minutes || 60; // Default 1 hour
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime.getTime() + durationMinutes * 60000);
      
      // Check if we go past 4:30 PM (16:30), move to next working day
      if (endTime.getUTCHours() > 16 || (endTime.getUTCHours() === 16 && endTime.getUTCMinutes() > 30)) {
        // Move to next working day
        currentTime.setUTCDate(currentTime.getUTCDate() + 1);
        currentTime.setUTCHours(8, 0, 0, 0);
        
        // Skip weekends
        while (currentTime.getUTCDay() === 0 || currentTime.getUTCDay() === 6) {
          currentTime.setUTCDate(currentTime.getUTCDate() + 1);
        }
        
        // Recalculate times for new day
        const newStartTime = new Date(currentTime);
        const newEndTime = new Date(currentTime.getTime() + durationMinutes * 60000);
        
        // Schedule the job
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: newStartTime.toISOString(),
            scheduled_end_at: newEndTime.toISOString(),
            scheduled_minutes: durationMinutes,
            schedule_status: 'scheduled'
          })
          .eq('id', stage.id);
        
        if (!updateError) {
          const woNo = stage.production_jobs?.wo_no || 'Unknown';
          const stageName = stage.production_stages?.name || 'Unknown';
          console.log(`✅ SCHEDULED: ${woNo} (${stageName}) ${newStartTime.toISOString().substring(11, 16)}-${newEndTime.toISOString().substring(11, 16)}`);
          scheduledCount++;
        }
        
        currentTime = newEndTime;
      } else {
        // Schedule the job in current day
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: startTime.toISOString(),
            scheduled_end_at: endTime.toISOString(),
            scheduled_minutes: durationMinutes,
            schedule_status: 'scheduled'
          })
          .eq('id', stage.id);
        
        if (!updateError) {
          const woNo = stage.production_jobs?.wo_no || 'Unknown';
          const stageName = stage.production_stages?.name || 'Unknown';
          console.log(`✅ SCHEDULED: ${woNo} (${stageName}) ${startTime.toISOString().substring(11, 16)}-${endTime.toISOString().substring(11, 16)}`);
          scheduledCount++;
        }
        
        currentTime = endTime;
      }
    }
    
    console.log(`🎉 COMPLETED! Scheduled ${scheduledCount} out of ${filteredStages.length} stages`);
    
    return new Response(
      JSON.stringify({ 
        message: `Successfully scheduled ${scheduledCount} stages starting tomorrow at 8:00 AM UTC`,
        scheduled_count: scheduledCount,
        start_time: tomorrow.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ SCHEDULER ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});