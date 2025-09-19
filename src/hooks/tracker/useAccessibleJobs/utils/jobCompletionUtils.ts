
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Helper to resolve stage instance ID from various inputs
 * Handles both production_stage_id and job_stage_instances.id
 */
const resolveStageInstance = async (jobId: string, stageId: string) => {
  console.log('🔍 Resolving stage instance:', { jobId, stageId });
  
  // First try to find by job_stage_instances.id (exact match)
  let { data: stageInstance, error } = await supabase
    .from('job_stage_instances')
    .select('*')
    .eq('job_id', jobId)
    .eq('id', stageId)
    .maybeSingle();

  if (!error && stageInstance) {
    console.log('✅ Found stage instance by ID:', stageInstance.id);
    return stageInstance;
  }

  // Fallback: try to find by production_stage_id
  const { data: fallbackInstance, error: fallbackError } = await supabase
    .from('job_stage_instances')
    .select('*')
    .eq('job_id', jobId)
    .eq('production_stage_id', stageId)
    .maybeSingle();

  if (!fallbackError && fallbackInstance) {
    console.log('✅ Found stage instance by production_stage_id:', fallbackInstance.id);
    return fallbackInstance;
  }

  console.error('❌ Could not resolve stage instance:', { jobId, stageId, error, fallbackError });
  return null;
};

export const completeJobStage = async (jobId: string, stageId: string): Promise<boolean> => {
  console.log('🔄 [jobCompletionUtils] Completing job stage:', { jobId, stageId });
  
  try {
    // Add detailed logging for troubleshooting
    console.log('🔍 User authentication check...');
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user?.id) {
      console.error('❌ Authentication error:', userError);
      toast.error('Authentication error - please refresh and try again');
      return false;
    }
    console.log('✅ User authenticated:', user.user.id);
    
    // CRITICAL FIX: Resolve the actual stage instance
    const stageInstance = await resolveStageInstance(jobId, stageId);
    if (!stageInstance) {
      console.error('❌ Stage instance not found:', { jobId, stageId });
      toast.error('Stage not found - please refresh and try again');
      return false;
    }

    // Ensure stage is active before completing
    if (stageInstance.status !== 'active') {
      console.log('⚠️ Stage not active, activating first...', stageInstance.status);
      const { error: activateError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: stageInstance.started_at || new Date().toISOString(),
          started_by: stageInstance.started_by || user.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstance.id);

      if (activateError) {
        console.error('❌ Failed to activate stage:', activateError);
        toast.error('Failed to activate stage');
        return false;
      }
    }
    
    // Get stage info to check if it's a proof stage  
    const { getStageInfoForProofCheck, triggerProofCompletionCalculation } = await import('../../utils/proofStageUtils');
    const stageInfo = await getStageInfoForProofCheck(stageInstance.id);
    
    // Use the advance_job_stage RPC function to properly complete and advance the job
    console.log('🚀 Calling advance_job_stage RPC with params:', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_current_stage_id: stageInstance.id, // Use resolved stage instance ID
      p_completed_by: user.user.id
    });
    
    const { data, error } = await supabase.rpc('advance_job_stage', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_current_stage_id: stageInstance.id, // Use resolved stage instance ID
      p_completed_by: user.user.id
    });
    
    console.log('📊 RPC response:', { data, error });

    if (error) {
      console.error('❌ Failed to complete job stage:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      
      // Provide more specific error messages
      if (error.message?.includes('function advance_job_stage') && error.message?.includes('does not exist')) {
        toast.error('Database function missing - please contact support');
      } else if (error.message?.includes('permission denied')) {
        toast.error('Permission denied - you may not have access to complete this job');
      } else {
        toast.error(`Failed to complete job stage: ${error.message || 'Unknown error'}`);
      }
      return false;
    }

    console.log('✅ Job stage completed successfully');

    // If this was a proof stage completion, trigger queue-based due date calculation
    if (stageInfo?.isProof && jobId) {
      await triggerProofCompletionCalculation(jobId, 'production_jobs');
    }
    
    // Check if this was the final stage - if so, mark the entire job as completed
    const { data: remainingStages, error: stagesError } = await supabase
      .from('job_stage_instances')
      .select('id')
      .eq('job_id', jobId)
      .eq('job_table_name', 'production_jobs')
      .neq('status', 'completed');

    if (stagesError) {
      console.error('❌ Error checking remaining stages:', stagesError);
    } else if (!remainingStages || remainingStages.length === 0) {
      // No more stages - mark the entire job as completed
      console.log('🎯 All stages completed, marking job as completed');
      
      const { error: jobUpdateError } = await supabase
        .from('production_jobs')
        .update({ 
          status: 'Completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (jobUpdateError) {
        console.error('❌ Failed to mark job as completed:', jobUpdateError);
        toast.error('Failed to mark job as completed');
      } else {
        console.log('✅ Job marked as completed successfully');
        toast.success('Job completed successfully!');
      }
    } else {
      toast.success('Job stage completed successfully');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error completing job:', error);
    toast.error('Failed to complete job');
    return false;
  }
};

export const markJobAsCompleted = async (jobId: string): Promise<boolean> => {
  console.log('🎯 markJobCompleted called for job:', jobId);
  
  try {
    // SIMPLE APPROACH: Just mark the job as completed with exact case "Completed"
    const { error: jobError } = await supabase
      .from('production_jobs')
      .update({ 
        status: 'Completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (jobError) {
      console.error('❌ Failed to mark job as completed:', jobError);
      toast.error('Failed to mark job as completed');
      return false;
    }

    console.log('✅ Job status updated to Completed successfully');

    // Also mark any existing stages as completed (but don't fail if this doesn't work)
    const { error: stageError } = await supabase
      .from('job_stage_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('job_id', jobId)
      .eq('job_table_name', 'production_jobs')
      .neq('status', 'completed');

    // Don't fail if stage update fails - job status is the source of truth
    if (stageError) {
      console.warn('⚠️ Could not update job stages, but job marked completed:', stageError);
    } else {
      console.log('✅ Job stages also marked as completed');
    }

    console.log('✅ Job marked as completed successfully');
    toast.success('Job marked as completed');
    
    return true;
  } catch (error) {
    console.error('❌ Error marking job as completed:', error);
    toast.error('Failed to mark job as completed');
    return false;
  }
};
