
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
    // CRITICAL FIX: Resolve the actual stage instance
    const stageInstance = await resolveStageInstance(jobId, stageId);
    if (!stageInstance) {
      console.error('❌ Stage instance not found:', { jobId, stageId });
      revertOptimisticUpdate(jobId, 'current_stage_status', originalStatus);
      toast.error('Stage not found - please refresh and try again');
      return false;
    }

    // Update the job stage instance to active status using resolved ID
    const { data, error } = await supabase
      .from('job_stage_instances')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        started_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', stageInstance.id) // Use resolved stage instance ID
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
