
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const completeJobStage = async (jobId: string, stageId: string): Promise<boolean> => {
  console.log('✅ Completing job stage:', { jobId, stageId });
  
  try {
    // Get stage info before completing to check if it's a proof stage
    const { data: stageData, error: stageQueryError } = await supabase
      .from('job_stage_instances')
      .select(`
        *,
        production_stages (
          id,
          name
        )
      `)
      .eq('job_id', jobId)
      .eq('job_table_name', 'production_jobs')
      .eq('production_stage_id', stageId)
      .single();

    const isProofStage = stageData?.production_stages?.name?.toLowerCase().includes('proof') || false;
    
    // Use the advance_job_stage RPC function to properly complete and advance the job
    const { data, error } = await supabase.rpc('advance_job_stage', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_current_stage_id: stageId,
      p_completed_by: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) {
      console.error('❌ Failed to complete job stage:', error);
      toast.error('Failed to complete job stage');
      return false;
    }

    console.log('✅ Job stage completed successfully');

    // If this was a proof stage completion, trigger queue-based due date calculation
    if (isProofStage && jobId) {
      console.log('🎯 Proof stage completed, triggering queue-based due date calculation...');
      
      try {
        const { data: calcData, error: calcError } = await supabase.functions.invoke('calculate-due-dates', {
          body: {
            jobIds: [jobId],
            tableName: 'production_jobs',
            priority: 'high',
            triggerReason: 'proof_approval'
          }
        });

        if (calcError) {
          console.error('❌ Error triggering queue-based calculation:', calcError);
          toast.error('Failed to update due date after proof approval');
        } else {
          console.log('✅ Queue-based calculation triggered:', calcData);
          toast.success('Due date updated based on current production queue');
        }
      } catch (calcErr) {
        console.error('❌ Error in queue calculation:', calcErr);
        toast.error('Failed to update due date');
      }
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
