
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorkflowChangeDetection {
  hasChanges: boolean;
  affectedJobsCount: number;
  changeDetails: {
    addedStages: Array<{ stage_id: string; stage_name: string; stage_order: number }>;
    removedStages: Array<{ stage_id: string; stage_name: string }>;
    reorderedStages: Array<{ stage_id: string; stage_name: string; old_order: number; new_order: number }>;
  };
}

export class WorkflowSyncService {
  static async detectWorkflowChanges(categoryId: string): Promise<WorkflowChangeDetection> {
    try {
      console.log('🔄 Detecting workflow changes for category:', categoryId);

      // Get current workflow definition
      const { data: currentWorkflow, error: workflowError } = await supabase
        .from('category_production_stages')
        .select(`
          production_stage_id,
          stage_order,
          production_stage:production_stages(name)
        `)
        .eq('category_id', categoryId)
        .order('stage_order');

      if (workflowError) throw workflowError;

      // Get existing job stage instances for this category
      const { data: existingStages, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          stage_order,
          job_id,
          production_stage:production_stages(name)
        `)
        .eq('category_id', categoryId)
        .eq('status', 'pending'); // Only check pending stages

      if (stagesError) throw stagesError;

      // Count affected jobs
      const affectedJobs = new Set(existingStages?.map(stage => stage.job_id) || []).size;

      // Analyze differences
      const currentStageIds = new Set(currentWorkflow?.map(s => s.production_stage_id) || []);
      const existingStageIds = new Set(existingStages?.map(s => s.production_stage_id) || []);

      const addedStages = (currentWorkflow || [])
        .filter(stage => !existingStageIds.has(stage.production_stage_id))
        .map(stage => ({
          stage_id: stage.production_stage_id,
          stage_name: stage.production_stage?.name || 'Unknown',
          stage_order: stage.stage_order
        }));

      const removedStages = Array.from(existingStageIds)
        .filter(stageId => !currentStageIds.has(stageId))
        .map(stageId => {
          const stage = existingStages?.find(s => s.production_stage_id === stageId);
          return {
            stage_id: stageId,
            stage_name: stage?.production_stage?.name || 'Unknown'
          };
        });

      // Check for reordering (simplified - just detect if any stage has different order)
      const reorderedStages: any[] = [];
      (currentWorkflow || []).forEach(currentStage => {
        const existingStage = existingStages?.find(s => s.production_stage_id === currentStage.production_stage_id);
        if (existingStage && existingStage.stage_order !== currentStage.stage_order) {
          reorderedStages.push({
            stage_id: currentStage.production_stage_id,
            stage_name: currentStage.production_stage?.name || 'Unknown',
            old_order: existingStage.stage_order,
            new_order: currentStage.stage_order
          });
        }
      });

      const hasChanges = addedStages.length > 0 || removedStages.length > 0 || reorderedStages.length > 0;

      return {
        hasChanges,
        affectedJobsCount: affectedJobs,
        changeDetails: {
          addedStages,
          removedStages,
          reorderedStages
        }
      };
    } catch (error) {
      console.error('❌ Error detecting workflow changes:', error);
      throw error;
    }
  }

  static async syncJobsToWorkflow(categoryId: string, syncOptions: {
    addNewStages: boolean;
    removeObsoleteStages: boolean;
    updateStageOrders: boolean;
  }): Promise<boolean> {
    try {
      console.log('🔄 Syncing jobs to workflow for category:', categoryId, syncOptions);

      // Get all jobs with pending stages for this category
      const { data: affectedJobs, error: jobsError } = await supabase
        .from('job_stage_instances')
        .select('job_id, job_table_name')
        .eq('category_id', categoryId)
        .eq('status', 'pending');

      if (jobsError) throw jobsError;

      const uniqueJobs = Array.from(
        new Map(affectedJobs?.map(job => [`${job.job_id}-${job.job_table_name}`, job]) || []).values()
      );

      let successCount = 0;

      for (const job of uniqueJobs) {
        try {
          if (syncOptions.removeObsoleteStages) {
            // Remove stages that are no longer in the workflow
            await this.removeObsoleteStages(job.job_id, job.job_table_name, categoryId);
          }

          if (syncOptions.addNewStages) {
            // Add new stages that were added to the workflow
            await this.addMissingStages(job.job_id, job.job_table_name, categoryId);
          }

          if (syncOptions.updateStageOrders) {
            // Update stage orders to match workflow
            await this.updateStageOrders(job.job_id, job.job_table_name, categoryId);
          }

          successCount++;
        } catch (error) {
          console.error(`❌ Error syncing job ${job.job_id}:`, error);
        }
      }

      console.log(`✅ Successfully synced ${successCount}/${uniqueJobs.length} jobs`);
      toast.success(`Successfully synced ${successCount} jobs to updated workflow`);
      return true;
    } catch (error) {
      console.error('❌ Error syncing jobs to workflow:', error);
      toast.error('Failed to sync jobs to workflow');
      return false;
    }
  }

  private static async removeObsoleteStages(jobId: string, jobTableName: string, categoryId: string): Promise<void> {
    // Get current workflow stage IDs
    const { data: workflowStages } = await supabase
      .from('category_production_stages')
      .select('production_stage_id')
      .eq('category_id', categoryId);

    const workflowStageIds = new Set(workflowStages?.map(s => s.production_stage_id) || []);

    // Remove job stage instances that are not in the current workflow
    const { error } = await supabase
      .from('job_stage_instances')
      .delete()
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .eq('category_id', categoryId)
      .eq('status', 'pending')
      .not('production_stage_id', 'in', `(${Array.from(workflowStageIds).join(',')})`);

    if (error) throw error;
  }

  private static async addMissingStages(jobId: string, jobTableName: string, categoryId: string): Promise<void> {
    // Use the existing RPC function to initialize missing stages
    const { error } = await supabase.rpc('initialize_job_stages', {
      p_job_id: jobId,
      p_job_table_name: jobTableName,
      p_category_id: categoryId
    });

    if (error) throw error;
  }

  private static async updateStageOrders(jobId: string, jobTableName: string, categoryId: string): Promise<void> {
    // Get current workflow stage orders
    const { data: workflowStages } = await supabase
      .from('category_production_stages')
      .select('production_stage_id, stage_order')
      .eq('category_id', categoryId);

    if (!workflowStages) return;

    // Update each job stage instance to match workflow order
    for (const workflowStage of workflowStages) {
      await supabase
        .from('job_stage_instances')
        .update({ stage_order: workflowStage.stage_order })
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .eq('category_id', categoryId)
        .eq('production_stage_id', workflowStage.production_stage_id)
        .eq('status', 'pending');
    }
  }
}
