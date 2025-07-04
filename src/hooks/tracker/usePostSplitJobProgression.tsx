import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface UsePostSplitJobProgressionReturn {
  ensureJobWorkflowContinuity: (jobId: string, batchContext?: string) => Promise<boolean>;
  validateJobStageIntegrity: (jobId: string) => Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }>;
  repairJobWorkflow: (jobId: string) => Promise<boolean>;
  isProcessing: boolean;
}

/**
 * Hook for managing post-split job progression and workflow continuity
 * Ensures individual jobs continue through workflow correctly after batch split
 */
export const usePostSplitJobProgression = (): UsePostSplitJobProgressionReturn => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Ensures a job's workflow continuity after being split from a batch
   */
  const ensureJobWorkflowContinuity = useCallback(async (
    jobId: string,
    batchContext?: string
  ): Promise<boolean> => {
    if (!user?.id) {
      console.error('User not authenticated');
      return false;
    }

    setIsProcessing(true);
    
    try {
      console.log('🔄 Ensuring workflow continuity for split job:', jobId);

      // Get current job state
      const { data: job, error: jobError } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          status,
          category_id,
          batch_ready,
          categories (
            id,
            name
          )
        `)
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        throw new Error(`Could not find job: ${jobError?.message}`);
      }

      // Check current stage instances
      const { data: stages, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          stage_order,
          status,
          started_at,
          completed_at,
          production_stages (
            name,
            color
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order', { ascending: true });

      if (stagesError) {
        throw new Error(`Could not get job stages: ${stagesError.message}`);
      }

      // Validate workflow state
      const activeStages = stages?.filter(s => s.status === 'active') || [];
      const pendingStages = stages?.filter(s => s.status === 'pending') || [];
      const completedStages = stages?.filter(s => s.status === 'completed') || [];

      console.log('📊 Job workflow state:', {
        jobId,
        totalStages: stages?.length || 0,
        activeStages: activeStages.length,
        pendingStages: pendingStages.length,
        completedStages: completedStages.length,
        currentStatus: job.status
      });

      // If no active stages and there are pending stages, activate the first pending stage
      if (activeStages.length === 0 && pendingStages.length > 0) {
        const nextStage = pendingStages[0];
        
        console.log('🎯 Activating next stage for split job:', nextStage.production_stages?.name);
        
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user.id,
            notes: batchContext ? `Activated after batch split: ${batchContext}` : 'Activated after batch split'
          })
          .eq('id', nextStage.id);

        if (activateError) {
          throw new Error(`Failed to activate next stage: ${activateError.message}`);
        }

        // Update job status to reflect current stage
        const { error: statusError } = await supabase
          .from('production_jobs')
          .update({
            status: nextStage.production_stages?.name || 'In Progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (statusError) {
          console.warn('Failed to update job status:', statusError);
        }

        console.log('✅ Job workflow continuity ensured for:', job.wo_no);
        return true;
      }

      // If no stages exist but job has category, initialize workflow
      if ((!stages || stages.length === 0) && job.category_id) {
        console.log('🔧 No stages found, initializing workflow for job:', job.wo_no);
        
        const { error: initError } = await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs',
          p_category_id: job.category_id
        });

        if (initError) {
          throw new Error(`Failed to initialize workflow: ${initError.message}`);
        }

        console.log('✅ Workflow initialized for split job:', job.wo_no);
        return true;
      }

      console.log('✅ Job workflow already in valid state:', job.wo_no);
      return true;

    } catch (error) {
      console.error('❌ Error ensuring job workflow continuity:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to ensure workflow continuity: ${errorMessage}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  /**
   * Validates job stage integrity and identifies issues
   */
  const validateJobStageIntegrity = useCallback(async (jobId: string) => {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Get job and its stages
      const { data: job, error: jobError } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          status,
          category_id,
          batch_ready,
          categories (
            name
          )
        `)
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        issues.push('Job not found or inaccessible');
        return { isValid: false, issues, recommendations };
      }

      // Check stages
      const { data: stages } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          stage_order,
          status,
          production_stages (
            name
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order', { ascending: true });

      const activeStages = stages?.filter(s => s.status === 'active') || [];
      const pendingStages = stages?.filter(s => s.status === 'pending') || [];

      // Validate stage state
      if (activeStages.length > 1) {
        issues.push(`Multiple active stages (${activeStages.length})`);
        recommendations.push('Only one stage should be active at a time');
      }

      if (activeStages.length === 0 && pendingStages.length > 0) {
        issues.push('No active stage but pending stages exist');
        recommendations.push('Activate the next pending stage');
      }

      if (!stages || stages.length === 0) {
        if (job.category_id) {
          issues.push('No workflow stages found');
          recommendations.push('Initialize workflow based on job category');
        } else {
          issues.push('No category assigned and no workflow stages');
          recommendations.push('Assign a category to initialize workflow');
        }
      }

      // Check for batch references that should be cleaned up
      if (!job.batch_ready) {
        const { data: batchRefs } = await supabase
          .from('batch_job_references')
          .select('id, status')
          .eq('production_job_id', jobId)
          .neq('status', 'completed');

        if (batchRefs && batchRefs.length > 0) {
          issues.push('Active batch references found for non-batched job');
          recommendations.push('Clean up batch references');
        }
      }

      const isValid = issues.length === 0;
      
      console.log('🔍 Job integrity validation result:', {
        jobId,
        woNo: job.wo_no,
        isValid,
        issues,
        recommendations
      });

      return { isValid, issues, recommendations };

    } catch (error) {
      console.error('❌ Error validating job integrity:', error);
      issues.push('Validation failed due to system error');
      return { isValid: false, issues, recommendations };
    }
  }, []);

  /**
   * Repairs job workflow issues automatically
   */
  const repairJobWorkflow = useCallback(async (jobId: string): Promise<boolean> => {
    if (!user?.id) {
      console.error('User not authenticated');
      return false;
    }

    setIsProcessing(true);

    try {
      console.log('🔧 Attempting to repair job workflow:', jobId);

      // First validate to identify issues
      const validation = await validateJobStageIntegrity(jobId);
      
      if (validation.isValid) {
        console.log('✅ Job workflow is already valid');
        return true;
      }

      console.log('🔧 Repairing workflow issues:', validation.issues);

      // Get job details
      const { data: job } = await supabase
        .from('production_jobs')
        .select('id, wo_no, category_id, batch_ready')
        .eq('id', jobId)
        .single();

      if (!job) {
        throw new Error('Job not found');
      }

      // Repair: Initialize workflow if missing and category exists
      if (validation.issues.includes('No workflow stages found') && job.category_id) {
        await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs',
          p_category_id: job.category_id
        });
        console.log('🔧 Initialized missing workflow');
      }

      // Repair: Clean up batch references for non-batched jobs
      if (!job.batch_ready && validation.issues.some(i => i.includes('batch references'))) {
        await supabase
          .from('batch_job_references')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('production_job_id', jobId)
          .neq('status', 'completed');
        console.log('🔧 Cleaned up batch references');
      }

      // Repair: Activate next stage if needed
      if (validation.issues.includes('No active stage but pending stages exist')) {
        await ensureJobWorkflowContinuity(jobId, 'Workflow repair');
      }

      // Repair: Fix multiple active stages
      if (validation.issues.some(i => i.includes('Multiple active stages'))) {
        // Keep only the earliest active stage
        const { data: stages } = await supabase
          .from('job_stage_instances')
          .select('id, stage_order')
          .eq('job_id', jobId)
          .eq('job_table_name', 'production_jobs')
          .eq('status', 'active')
          .order('stage_order', { ascending: true });

        if (stages && stages.length > 1) {
          // Keep the first, reset others to pending
          for (let i = 1; i < stages.length; i++) {
            await supabase
              .from('job_stage_instances')
              .update({
                status: 'pending',
                started_at: null,
                started_by: null
              })
              .eq('id', stages[i].id);
          }
          console.log('🔧 Fixed multiple active stages');
        }
      }

      console.log('✅ Job workflow repair completed for:', job.wo_no);
      toast.success(`Workflow repaired for job ${job.wo_no}`);
      return true;

    } catch (error) {
      console.error('❌ Error repairing job workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to repair workflow: ${errorMessage}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, validateJobStageIntegrity, ensureJobWorkflowContinuity]);

  return {
    ensureJobWorkflowContinuity,
    validateJobStageIntegrity,
    repairJobWorkflow,
    isProcessing
  };
};
