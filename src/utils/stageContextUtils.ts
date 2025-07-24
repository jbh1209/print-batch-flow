import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

export interface StageContext {
  stageId: string;
  stageName: string;
  stageColor: string;
  stageStatus: string;
  stageOrder: number;
}

/**
 * Gets the appropriate stage context for a job in a specific stage queue
 */
export const getStageContextForJob = (
  job: AccessibleJob,
  contextStageName?: string | null
): StageContext => {
  // If no context stage specified, use job's current stage
  if (!contextStageName) {
    return {
      stageId: job.current_stage_id || '',
      stageName: job.current_stage_name || job.display_stage_name || '',
      stageColor: job.current_stage_color || '',
      stageStatus: job.current_stage_status || '',
      stageOrder: job.current_stage_order || 0
    };
  }

  // Look for matching parallel stage
  if (job.parallel_stages && job.parallel_stages.length > 0) {
    const matchingStage = job.parallel_stages.find(
      stage => stage.stage_name === contextStageName
    );
    
    if (matchingStage) {
      return {
        stageId: matchingStage.stage_id,
        stageName: matchingStage.stage_name,
        stageColor: matchingStage.stage_color,
        stageStatus: matchingStage.stage_status,
        stageOrder: matchingStage.stage_order
      };
    }
  }

  // Fallback to current stage if no parallel stage match found
  return {
    stageId: job.current_stage_id || '',
    stageName: job.current_stage_name || job.display_stage_name || '',
    stageColor: job.current_stage_color || '',
    stageStatus: job.current_stage_status || '',
    stageOrder: job.current_stage_order || 0
  };
};

/**
 * Checks if a job can start in the context stage
 */
export const canStartContextStage = (
  job: AccessibleJob,
  stageContext: StageContext
): boolean => {
  return job.user_can_work && stageContext.stageStatus === 'pending';
};

/**
 * Checks if a job can complete in the context stage
 */
export const canCompleteContextStage = (
  job: AccessibleJob,
  stageContext: StageContext
): boolean => {
  return job.user_can_work && stageContext.stageStatus === 'active';
};