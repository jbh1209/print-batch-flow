// Utility functions for handling parallel/concurrent stages

export interface ParallelStageInfo {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_status: string;
  stage_order: number;
}

export interface JobWithParallelStages {
  job_id: string;
  wo_no: string;
  parallel_stages: ParallelStageInfo[];
  current_stage_order?: number;
}

export const getJobParallelStages = (
  jobStages: any[], 
  jobId: string
): ParallelStageInfo[] => {
  if (!jobStages || jobStages.length === 0) return [];
  
  // Find all active/pending stages for this job
  const activeStages = jobStages.filter(stage => 
    stage.job_id === jobId && 
    (stage.status === 'active' || stage.status === 'pending')
  );
  
  if (activeStages.length === 0) return [];
  
  // Get the current stage order (lowest order among active/pending stages)
  const currentOrder = Math.min(...activeStages.map(s => s.stage_order));
  
  // Return all stages at the current order level (parallel stages)
  return activeStages
    .filter(stage => stage.stage_order === currentOrder)
    .map(stage => ({
      stage_id: stage.production_stage_id,
      stage_name: stage.stage_name,
      stage_color: stage.stage_color || '#6B7280',
      stage_status: stage.status,
      stage_order: stage.stage_order
    }));
};

export const shouldJobAppearInStage = (
  parallelStages: ParallelStageInfo[],
  targetStageId: string
): boolean => {
  return parallelStages.some(stage => stage.stage_id === targetStageId);
};

export const getJobsForStage = (
  jobs: any[],
  jobStagesMap: Map<string, any[]>,
  stageId: string
): any[] => {
  return jobs.filter(job => {
    const jobStages = jobStagesMap.get(job.job_id) || [];
    const parallelStages = getJobParallelStages(jobStages, job.job_id);
    return shouldJobAppearInStage(parallelStages, stageId);
  });
};