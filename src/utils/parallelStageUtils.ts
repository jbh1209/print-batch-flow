import { debugService } from '@/services/DebugService';

// Define interface for parallel stage information  
export interface ParallelStageInfo {
  id: string;
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_status: string;
  stage_order: number;
  part_assignment: string | null;
}

export interface JobWithParallelStages {
  id: string;
  stages: ParallelStageInfo[];
  dependencies: DependencyChain[];
}

export interface DependencyChain {
  stageId: string;
  predecessors: string[];
  successors: string[];
  isCriticalPath: boolean;
}

/**
 * SIMPLIFIED PARALLEL STAGE PROCESSING
 * 
 * This function has been simplified to work with the new database-level
 * part-specific stage advancement. The complex parallel processing logic
 * has been moved to the database function `advance_job_stage_with_part_support`.
 */
export const getJobParallelStages = (
  jobStages: any[], 
  jobId: string
): ParallelStageInfo[] => {
  if (!jobStages || jobStages.length === 0) return [];
  
  // Find all stages for this job
  const allJobStages = jobStages.filter(stage => stage.job_id === jobId);
  
  if (allJobStages.length === 0) return [];
  
  // Find current active stages - these are the ones currently being worked on
  const activeStages = allJobStages.filter(stage => stage.status === 'active');
  
  if (activeStages.length > 0) {
    // Return active stages for display
    const currentOrder = Math.min(...activeStages.map(s => s.stage_order));
    const currentParallelStages = activeStages
      .filter(stage => stage.stage_order === currentOrder)
      .map(stage => ({
        id: stage.id,
        stage_id: stage.production_stage_id,
        stage_name: stage.stage_name,
        stage_color: stage.stage_color || '#6B7280',
        stage_status: stage.status,
        stage_order: stage.stage_order,
        part_assignment: stage.part_assignment || null
      }));
      
    return currentParallelStages;
  }
  
  // Check for next parallel stages that should be activated
  const pendingStages = allJobStages.filter(stage => stage.status === 'pending');
  if (pendingStages.length > 0) {
    // Find the next stage order that should be activated
    const nextOrder = Math.min(...pendingStages.map(s => s.stage_order));
    const nextParallelStages = pendingStages
      .filter(stage => stage.stage_order === nextOrder)
      .map(stage => ({
        id: stage.id,
        stage_id: stage.production_stage_id,
        stage_name: stage.stage_name,
        stage_color: stage.stage_color || '#6B7280',
        stage_status: stage.status,
        stage_order: stage.stage_order,
        part_assignment: stage.part_assignment || null
      }));
      
    return nextParallelStages;
  }
  
  return [];
};

export const shouldJobAppearInStage = (parallelStages: ParallelStageInfo[], targetStageId: string): boolean => {
  return parallelStages.some(stage => stage.stage_id === targetStageId);
};

export const getJobsForStage = (jobs: any[], jobStagesMap: Map<string, any[]>, stageId: string): any[] => {
  return jobs.filter(job => {
    const stages = jobStagesMap.get(job.id);
    if (!stages) return false;
    
    const parallelStages = getJobParallelStages(stages, job.id);
    return shouldJobAppearInStage(parallelStages, stageId);
  });
};

// Legacy functions kept for compatibility but simplified
export const buildDependencyChain = (jobStages: any[], jobId: string): DependencyChain[] => {
  const allJobStages = jobStages.filter(stage => stage.job_id === jobId);
  
  return allJobStages.map(stage => ({
    stageId: stage.production_stage_id,
    predecessors: [],
    successors: [],
    isCriticalPath: false
  }));
};

export const findCriticalPath = (dependencies: DependencyChain[]): string[] => {
  return [];
};

export const canStageStart = (stageId: string, dependencies: DependencyChain[], completedStages: string[]): boolean => {
  return true; // Database function handles this logic now
};

export const getNextAvailableStages = (dependencies: DependencyChain[], completedStages: string[], activeStages: string[]): string[] => {
  return []; // Database function handles this logic now
};