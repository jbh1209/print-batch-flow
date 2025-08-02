
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const completeJobStage = async (jobId: string, stageId: string, notes?: string): Promise<boolean> => {
  console.log('🔄 [jobCompletionUtils] Completing job stage:', { jobId, stageId });
  
  try {
    // Get stage info to check if it's a proof stage  
    const { getStageInfoForProofCheck, triggerProofCompletionCalculation } = await import('../../utils/proofStageUtils');
    const stageInfo = await getStageInfoForProofCheck(stageId);
    
    // Use the new part-specific advancement function for proper parallel processing
    const { data, error } = await supabase.rpc('advance_job_stage_with_parallel_support', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_current_stage_id: stageId,
      p_notes: notes
    });

    if (error) {
      console.error('❌ Failed to complete job stage:', error);
      toast.error('Failed to complete job stage');
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
