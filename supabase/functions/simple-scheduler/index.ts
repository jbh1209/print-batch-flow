/**
 * DEAD SIMPLE SCHEDULER - Just put jobs one after another starting at 8AM tomorrow
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

    console.log('🚀 SIMPLE SCHEDULER STARTING...');
    
    // STEP 1: NUCLEAR RESET - Clear ALL scheduled data
    console.log('💥 CLEARING ALL SCHEDULED DATA...');
    const { error: resetError } = await supabase
      .from('job_stage_instances')
      .update({
        scheduled_start_at: null,
        scheduled_end_at: null,
        scheduled_minutes: null,
        schedule_status: 'unscheduled',
        scheduled_by_user_id: null,
        scheduling_method: null
      })
      .not('id', 'is', null);
    
    if (resetError) {
      console.error('❌ Reset error:', resetError);
      throw resetError;
    }
    console.log('✅ All scheduled data cleared');
    
    // STEP 2: Get pending jobs (NOT completed) - fixed approach
    console.log('📋 Getting pending jobs...');
    
    // First get all job stage instances that are pending/active
    const { data: stageInstances, error: stageError } = await supabase
      .from('job_stage_instances')
      .select('id, job_id, production_stage_id, estimated_duration_minutes')
      .in('status', ['pending', 'active']);
    
    if (stageError) {
      console.error('❌ Stage instances fetch error:', stageError);
      throw stageError;
    }
    
    console.log(`🔍 Found ${stageInstances?.length || 0} total stage instances`);
    
    if (!stageInstances || stageInstances.length === 0) {
      console.log('✅ No stage instances found');
      return new Response(
        JSON.stringify({ message: 'No stages to schedule', scheduled_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get production stages to filter out unwanted stages
    const { data: productionStages, error: stagesError } = await supabase
      .from('production_stages')
      .select('id, name')
      .in('id', stageInstances.map(s => s.production_stage_id));
    
    if (stagesError) {
      console.error('❌ Production stages fetch error:', stagesError);
      throw stagesError;
    }
    
    console.log(`🔍 Found ${productionStages?.length || 0} production stages`);
    
    // Filter out unwanted stages (DTP, Proof, Batch Allocation)
    const filteredStageInstances = stageInstances.filter(stage => {
      const prodStage = productionStages.find(ps => ps.id === stage.production_stage_id);
      if (!prodStage) return false;
      
      const stageName = prodStage.name.toLowerCase();
      return !stageName.includes('dtp') && 
             !stageName.includes('proof') && 
             !stageName.includes('batch allocation');
    });
    
    console.log(`🔍 After filtering: ${filteredStageInstances.length} stage instances remain`);
    
    if (filteredStageInstances.length === 0) {
      console.log('✅ No stage instances found after filtering');
      return new Response(
        JSON.stringify({ message: 'No stages to schedule after filtering', scheduled_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get unique job IDs from filtered stages
    const jobIds = [...new Set(filteredStageInstances.map(s => s.job_id))];
    console.log(`🔍 Looking for ${jobIds.length} unique jobs`);
    
    // Get production jobs that are approved and not completed
    const { data: jobs, error: jobError } = await supabase
      .from('production_jobs')
      .select('id, wo_no, proof_approved_at, status')
      .in('id', jobIds)
      .neq('status', 'Completed')
      .not('proof_approved_at', 'is', null)
      .order('proof_approved_at', { ascending: true });
    
    if (jobError) {
      console.error('❌ Jobs fetch error:', jobError);
      throw jobError;
    }
    
    console.log(`🔍 Found ${jobs?.length || 0} approved production jobs`);
    
    // Combine the data with proper stage names
    const stages = filteredStageInstances
      .filter(stage => jobs.some(job => job.id === stage.job_id))
      .map(stage => {
        const job = jobs.find(j => j.id === stage.job_id);
        const prodStage = productionStages.find(ps => ps.id === stage.production_stage_id);
        return {
          id: stage.id,
          job_id: stage.job_id,
          estimated_duration_minutes: stage.estimated_duration_minutes,
          production_stages: { name: prodStage?.name || 'Unknown' },
          production_jobs: job
        };
      })
      .sort((a, b) => new Date(a.production_jobs.proof_approved_at).getTime() - new Date(b.production_jobs.proof_approved_at).getTime());
    
    const fetchError = null;

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      throw fetchError;
    }

    console.log(`✅ Found ${stages?.length || 0} stages to schedule`);

    if (!stages || stages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No stages to schedule', scheduled_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 3: Start scheduling from tomorrow 8:00 AM UTC
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
    
    // STEP 4: Schedule each job sequentially
    for (const stage of stages) {
      const durationMinutes = stage.estimated_duration_minutes || 60;
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime.getTime() + durationMinutes * 60000);
      
      // Check if we need to respect lunch break (13:00-13:30)
      const startHour = startTime.getUTCHours();
      const endHour = endTime.getUTCHours();
      
      // If we cross lunch time, move start to after lunch
      if (startHour < 13 && endHour >= 13) {
        const lunchEnd = new Date(startTime);
        lunchEnd.setUTCHours(13, 30, 0, 0);
        currentTime = lunchEnd;
        continue; // Reschedule this job after lunch
      }
      
      // If we go past 16:30, move to next working day
      if (endTime.getUTCHours() > 16 || (endTime.getUTCHours() === 16 && endTime.getUTCMinutes() > 30)) {
        // Move to next working day
        currentTime.setUTCDate(currentTime.getUTCDate() + 1);
        currentTime.setUTCHours(8, 0, 0, 0);
        
        // Skip weekends
        while (currentTime.getUTCDay() === 0 || currentTime.getUTCDay() === 6) {
          currentTime.setUTCDate(currentTime.getUTCDate() + 1);
        }
        continue; // Reschedule this job for next day
      }
      
      // Schedule the job
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: startTime.toISOString(),
          scheduled_end_at: endTime.toISOString(),
          scheduled_minutes: durationMinutes,
          schedule_status: 'scheduled',
          scheduling_method: 'simple'
        })
        .eq('id', stage.id);
      
      if (updateError) {
        console.error(`❌ Failed to schedule ${stage.id}:`, updateError);
        continue;
      }
      
      const woNo = (stage.production_jobs as any)?.wo_no || 'Unknown';
      const stageName = (stage.production_stages as any)?.name || 'Unknown';
      
      console.log(`✅ SCHEDULED: ${woNo} (${stageName}) ${startTime.toISOString().substring(11, 16)}-${endTime.toISOString().substring(11, 16)}`);
      
      scheduledCount++;
      currentTime = endTime; // Move cursor to end of this job
    }
    
    console.log(`🎉 COMPLETED! Scheduled ${scheduledCount} jobs starting tomorrow at 8:00 AM UTC`);
    
    return new Response(
      JSON.stringify({ 
        message: `Successfully scheduled ${scheduledCount} jobs starting tomorrow at 8:00 AM UTC`,
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