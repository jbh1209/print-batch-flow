
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
    // CRITICAL FIX: Use the unique job_stage_instances.id instead of job_id + production_stage_id
    // This prevents cross-contamination between parallel stages
    console.log('🔧 Updating job_stage_instances with unique ID:', stageId);
    
    const { data, error } = await supabase
      .from('job_stage_instances')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        started_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', stageId) // Use unique ID instead of job_id + production_stage_id
      .eq('status', 'pending')
      .select(); // Return the updated record for verification

    if (error) {
      console.error('❌ Failed to start job:', error);
      revertOptimisticUpdate(jobId, 'current_stage_status', originalStatus);
      toast.error('Failed to start job');
      return false;
    }

    // Safety check: ensure exactly one record was updated
    if (!data || data.length !== 1) {
      console.error('❌ Unexpected number of records updated:', data?.length || 0);
      revertOptimisticUpdate(jobId, 'current_stage_status', originalStatus);
      toast.error('Failed to start job - database integrity issue');
      return false;
    }

    const updatedStage = data[0];
    console.log('✅ Job stage started successfully:', {
      stageId,
      jobId: updatedStage.job_id,
      productionStageId: updatedStage.production_stage_id,
      partAssignment: updatedStage.part_assignment
    });
    
    toast.success('Job started successfully');
    return true;
  } catch (error) {
    console.error('❌ Error starting job:', error);
    revertOptimisticUpdate(jobId, 'current_stage_status', originalStatus);
    toast.error('Failed to start job');
    return false;
  }
};
