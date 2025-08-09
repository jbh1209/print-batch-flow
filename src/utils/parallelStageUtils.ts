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
 * ENHANCED PARALLEL STAGE PROCESSING WITH DEPENDENCY GROUPS
 * 
 * This function identifies stages that are ready to be worked on based on:
 * 1. Currently active stages (being worked on)
 * 2. Pending stages whose prerequisites are met (ready to start)
 */
export const getJobParallelStages = (
  jobStages: any[], 
  jobId: string
): ParallelStageInfo[] => {
  if (!jobStages || jobStages.length === 0) return [];
  
  // Find all stages for this job
  const allJobStages = jobStages.filter(stage => stage.job_id === jobId);
  
  if (allJobStages.length === 0) return [];
  
  // Always include active stages
  const activeStages = allJobStages.filter(stage => stage.status === 'active');
  
  // Find pending stages that are ready to start
  const pendingStages = allJobStages.filter(stage => stage.status === 'pending');
  const readyStages = [];
  
  for (const pendingStage of pendingStages) {
    const isReadyToStart = canStageStartBasedOnDependencies(pendingStage, allJobStages);
    if (isReadyToStart) {
      readyStages.push(pendingStage);
    }
  }
  
  // Combine active and ready stages
  const availableStages = [...activeStages, ...readyStages];
  
  // Convert to ParallelStageInfo format
  return availableStages.map(stage => ({
    id: stage.id,
    stage_id: stage.production_stage_id,
    stage_name: stage.stage_name,
    stage_color: stage.stage_color || '#6B7280',
    stage_status: stage.status,
    stage_order: stage.stage_order,
    part_assignment: stage.part_assignment || null
  }));
};

/**
 * Check if a pending stage can start based on dependency logic
 */
const canStageStartBasedOnDependencies = (pendingStage: any, allJobStages: any[]): boolean => {
  // If stage has no dependency group, check if prerequisite stages for the same part are completed
  if (!pendingStage.dependency_group) {
    return canPartSpecificStageStart(pendingStage, allJobStages);
  }
  
  // For dependency group stages, check if prerequisites for THIS part are met
  // This allows part-specific stages (like Hunkeler for text) to proceed when text prerequisites are complete
  // without waiting for cover stages to be ready
  return canPartSpecificStageStart(pendingStage, allJobStages);
};

/**
 * Check if a part-specific stage can start (no dependency group)
 */
const canPartSpecificStageStart = (pendingStage: any, allJobStages: any[]): boolean => {
  const partAssignment = pendingStage.part_assignment;
  const stageOrder = pendingStage.stage_order;
  
  // Find the previous stage in the workflow for the same part assignment
  const previousStages = allJobStages.filter(stage => 
    stage.part_assignment === partAssignment &&
    stage.stage_order < stageOrder &&
    !stage.dependency_group // Only consider stages without dependency groups for linear progression
  );
  
  if (previousStages.length === 0) {
    // No previous stages for this part, so this can start
    return true;
  }
  
  // Check if the immediate previous stage for this part is completed
  const sortedPreviousStages = previousStages.sort((a, b) => b.stage_order - a.stage_order);
  const immediatePrevious = sortedPreviousStages[0];
  
  return immediatePrevious.status === 'completed';
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