
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const startJobStage = async (
  jobId: string, 
  stageId: string,
  applyOptimisticUpdate: (jobId: string, updates: any) => void,
  revertOptimisticUpdate: (jobId: string, field: string, originalValue: any) => void
): Promise<boolean> => {
  console.log('🎬 Starting job:', { jobId, stageId });
  
  // Optimistic update
  const originalStatus = 'pending';
  applyOptimisticUpdate(jobId, { current_stage_status: 'active' });

  try {
    // Update the job stage instance to active status
    const { data, error } = await supabase
      .from('job_stage_instances')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        started_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('job_id', jobId)
      .eq('job_table_name', 'production_jobs')
      .eq('production_stage_id', stageId)
      .eq('status', 'pending');

    if (error) {
      console.error('❌ Failed to start job:', error);
      revertOptimisticUpdate(jobId, 'current_stage_status', originalStatus);
      toast.error('Failed to start job');
      return false;
    }

    console.log('✅ Job started successfully');
    toast.success('Job started successfully');
    return true;
  } catch (error) {
    console.error('❌ Error starting job:', error);
    revertOptimisticUpdate(jobId, 'current_stage_status', originalStatus);
    toast.error('Failed to start job');
    return false;
  }
};
