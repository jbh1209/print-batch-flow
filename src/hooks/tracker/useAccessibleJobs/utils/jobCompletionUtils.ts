/**
 * SIMPLIFIED job completion detection utilities
 * Single source of truth: job.status field with proper case handling
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JobLike {
  status?: string | null;
  current_stage_status?: string | null;
  workflow_progress?: number;
}

/**
 * SIMPLE: Check if job is completed based ONLY on job status
 * This is the single source of truth for completion status
 * ONLY checks for exact match: "Completed"
 */
export const isJobCompleted = (job: JobLike): boolean => {
  if (!job) return false;
  
  // Simple check: completed jobs have status = "Completed" (exact match)
  return job.status === 'Completed';
};

/**
 * Filters out completed jobs from an array
 */
export const filterActiveJobs = <T extends JobLike>(jobs: T[]): T[] => {
  return jobs.filter(job => !isJobCompleted(job));
};

/**
 * Filters for only completed jobs from an array
 */
export const filterCompletedJobs = <T extends JobLike>(jobs: T[]): T[] => {
  return jobs.filter(job => isJobCompleted(job));
};

/**
 * Gets job counts with proper completion filtering
 */
export const getJobCounts = <T extends JobLike>(jobs: T[]) => {
  const activeJobs = filterActiveJobs(jobs);
  const completedJobs = filterCompletedJobs(jobs);

  return {
    total: jobs.length,
    active: activeJobs.length,
    completed: completedJobs.length,
    activeJobs,
    completedJobs
  };
};

/**
 * Safe job start helper with consistent error handling
 */
export const startJobStage = async (
  jobId: string, 
  stageId: string, 
  userId: string,
  jobTableName = 'production_jobs'
): Promise<boolean> => {
  const loadingToast = toast.loading("Starting stage...");

  try {
    console.log(`Starting stage for job ${jobId}, stage ${stageId}, user ${userId}`);

    // Start the job stage instance
    const { error: startError } = await supabase
      .from('job_stage_instances')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        started_by: userId
      })
      .eq('job_id', jobId)
      .eq('production_stage_id', stageId)
      .eq('job_table_name', jobTableName)
      .eq('status', 'pending');

    if (startError) {
      console.error('Start error:', startError);
      throw startError;
    }

    toast.dismiss(loadingToast);
    toast.success("Stage started successfully");
    return true;
  } catch (error) {
    console.error('Failed to start job stage:', error);
    toast.dismiss(loadingToast);
    toast.error("Failed to start stage");
    return false;
  }
};

/**
 * Safe job completion helper with RPC + fallback and improved toast handling
 */
export const completeJobStage = async (
  jobId: string, 
  stageId: string,
  jobTableName = 'production_jobs',
  notes = 'Stage completed'
): Promise<boolean> => {
  const loadingToast = toast.loading("Completing stage...");

  try {
    console.log(`Completing stage for job ${jobId}, stage ${stageId}, table ${jobTableName}`);

    // Pre-completion check: ensure the stage is active
    const { data: currentStage, error: checkError } = await supabase
      .from('job_stage_instances')
      .select('status')
      .eq('job_id', jobId)
      .eq('production_stage_id', stageId)
      .eq('job_table_name', jobTableName)
      .single();

    if (checkError) {
      console.error('Pre-completion check failed:', checkError);
      toast.dismiss(loadingToast);
      toast.error("Stage not found");
      return false;
    }

    if (currentStage?.status !== 'active') {
      console.log('Stage not active, current status:', currentStage?.status);
      toast.dismiss(loadingToast);
      toast.error("Please scan again to complete (stage must be active)");
      return false;
    }

    // Get user for completion tracking
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      console.error('Authentication error:', userError);
      toast.dismiss(loadingToast);
      toast.error('Authentication error - please refresh and try again');
      return false;
    }

    // Try RPC first
    try {
      const { error: rpcError } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_current_stage_id: stageId,
        p_notes: notes
      });

      if (!rpcError) {
        console.log('RPC completion successful');
        toast.dismiss(loadingToast);
        toast.success("Stage completed successfully");
        return true;
      }

      // Log RPC failure but don't show user error - proceed to fallback
      console.log('RPC failed, using fallback:', rpcError);
    } catch (rpcError) {
      console.log('RPC exception, using fallback:', rpcError);
    }

    // Fallback: Direct database update
    const { error: fallbackError } = await supabase
      .from('job_stage_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        notes: notes
      })
      .eq('job_id', jobId)
      .eq('production_stage_id', stageId)
      .eq('job_table_name', jobTableName);

    if (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      toast.dismiss(loadingToast);
      toast.error("Failed to complete stage");
      return false;
    }

    console.log('Fallback completion successful');
    toast.dismiss(loadingToast);
    toast.success("Stage completed successfully");
    return true;

  } catch (error) {
    console.error('Complete stage error:', error);
    toast.dismiss(loadingToast);
    toast.error("Failed to complete stage");
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