
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    // Get stage info to check if it's a proof stage  
    const { getStageInfoForProofCheck, triggerProofCompletionCalculation } = await import('../../utils/proofStageUtils');
    const stageInfo = await getStageInfoForProofCheck(stageId);
    
    // Use the advance_job_stage RPC function to properly complete and advance the job
    console.log('🚀 Calling advance_job_stage RPC with params:', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_current_stage_id: stageId,
      p_completed_by: user.user.id
    });
    
    const { data, error } = await supabase.rpc('advance_job_stage', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_current_stage_id: stageId,
      p_completed_by: user.user.id
    });
    
    console.log('📊 RPC response:', { data, error });

    let completedVia: 'rpc' | 'fallback' = 'rpc';

    if (error) {
      console.error('❌ Failed to complete job stage via RPC:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));

      // Provide more specific error messages
      if (error.message?.includes('function advance_job_stage') && error.message?.includes('does not exist')) {
        toast.error('Database function missing - attempting safe fallback');
      } else if (error.message?.includes('permission denied')) {
        toast.error('Permission denied via RPC - attempting safe fallback');
      } else {
        toast.error(`Failed to complete via RPC: ${error.message || 'Unknown error'} - attempting fallback`);
      }

      // Fallback: directly mark the stage as completed (simple, safe)
      try {
        const userId = user.user.id;
        const nowIso = new Date().toISOString();

        // Prefer completing an active stage
        const { data: updatedActive, error: updateErrorActive } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'completed',
            completed_at: nowIso,
            completed_by: userId,
            updated_at: nowIso
          })
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs')
          .eq('production_stage_id', stageId)
          .eq('status', 'active')
          .select('id');

        if (updateErrorActive) {
          console.error('❌ Fallback (active) update failed:', updateErrorActive);
          toast.error(`Fallback completion failed: ${updateErrorActive.message || 'Unknown error'}`);
          return false;
        }

        let updatedCount = (updatedActive?.length ?? 0);

        // If nothing was active, as a last resort allow completing a pending stage (some flows may skip start)
        if (updatedCount === 0) {
          const { data: updatedPending, error: updateErrorPending } = await supabase
            .from('job_stage_instances')
            .update({
              status: 'completed',
              completed_at: nowIso,
              completed_by: userId,
              updated_at: nowIso
            })
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs')
            .eq('production_stage_id', stageId)
            .eq('status', 'pending')
            .select('id');

          if (updateErrorPending) {
            console.error('❌ Fallback (pending) update failed:', updateErrorPending);
            toast.error(`Fallback completion failed: ${updateErrorPending.message || 'Unknown error'}`);
            return false;
          }

          updatedCount = (updatedPending?.length ?? 0);
        }

        if (updatedCount === 0) {
          console.warn('⚠️ Fallback found no matching stage to complete');
          toast.error('No matching stage found to complete');
          return false;
        }

        completedVia = 'fallback';
        console.log('✅ Job stage completed via fallback update');
      } catch (fallbackError: any) {
        console.error('❌ Fallback completion threw an error:', fallbackError);
        toast.error('Fallback completion failed');
        return false;
      }
    }

    console.log(`✅ Job stage completed successfully (${completedVia})`);

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
