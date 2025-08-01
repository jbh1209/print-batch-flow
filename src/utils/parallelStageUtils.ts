// Utility functions for handling parallel/concurrent stages and dependency chains
import { debugService } from '@/services/DebugService';

export interface ParallelStageInfo {
  id: string; // Add the unique job_stage_instances.id
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_status: string;
  stage_order: number;
  part_assignment?: string;
  is_critical_path?: boolean;
  dependency_type?: 'sequential' | 'parallel' | 'merge';
  predecessor_stages?: string[];
  successor_stages?: string[];
}

export interface JobWithParallelStages {
  job_id: string;
  wo_no: string;
  parallel_stages: ParallelStageInfo[];
  current_stage_order?: number;
  critical_path?: string[];
  dependency_chains?: DependencyChain[];
}

export interface DependencyChain {
  job_id: string;
  stage_id: string;
  predecessor_stage_ids: string[];
  successor_stage_ids: string[];
  dependency_type: 'sequential' | 'parallel' | 'merge';
  is_critical_path: boolean;
  estimated_start_date?: Date;
  estimated_completion_date?: Date;
}

export const getJobParallelStages = (
  jobStages: any[], 
  jobId: string
): ParallelStageInfo[] => {
  if (!jobStages || jobStages.length === 0) return [];
  
  // Find all stages for this job (including completed ones)
  const allJobStages = jobStages.filter(stage => stage.job_id === jobId);
  
  if (allJobStages.length === 0) return [];
  
  // Find all active/pending stages
  const activeStages = allJobStages.filter(stage => 
    stage.status === 'active' || stage.status === 'pending'
  );
  
  // Find completed stages
  const completedStages = allJobStages.filter(stage => 
    stage.status === 'completed'
  );
  
  const stageDetails = allJobStages.map(s => ({
    stage_id: s.production_stage_id,
    stage_name: s.stage_name,
    stage_order: s.stage_order,
    status: s.status,
    part_assignment: s.part_assignment
  }));

  console.log(`🔧 getJobParallelStages for job ${jobId}:`, {
    totalStages: allJobStages.length,
    activeStages: activeStages.length,
    completedStages: completedStages.length,
    stageDetails
  });

  debugService.log('ParallelStageUtils', 'getJobParallelStages', {
    jobId,
    totalStages: allJobStages.length,
    activeStages: activeStages.length,
    completedStages: completedStages.length,
    stageDetails
  });
  
  // If we have active stages, return them at current order level
  if (activeStages.length > 0) {
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
      
    console.log(`🎯 Returning ${currentParallelStages.length} active stages at order ${currentOrder}`);
    debugService.logParallelStageTransition(jobId, 'current_active', currentParallelStages.map(s => s.stage_name));
    return currentParallelStages;
  }
  
  // PARALLEL PROCESSING FIX: If no active stages but have completed stages,
  // check for next available stages based on parallel processing rules
  if (completedStages.length > 0) {
    const maxCompletedOrder = Math.max(...completedStages.map(s => s.stage_order));
    
    // For parallel processing, look for stages that can be activated based on completed stages
    const availableStages = allJobStages.filter(stage => {
      if (stage.status !== 'pending') return false;
      
      // ENHANCED PARALLEL PROCESSING LOGIC:
      // 1. Check if this stage's order is next in sequence
      const isNextSequential = stage.stage_order === maxCompletedOrder + 1;
      
      // 2. Check for part-specific stage progression
      const canRunBasedOnParts = completedStages.some(completed => {
        // Same part assignment can progress (Text -> Text, Cover -> Cover)
        if (completed.part_assignment === stage.part_assignment) {
          return true;
        }
        
        // 'both' stages unlock part-specific stages
        if (completed.part_assignment === 'both' && stage.part_assignment !== 'both') {
          return true;
        }
        
        // Part-specific stages can unlock 'both' stages if this is the right order
        if (stage.part_assignment === 'both' && completed.part_assignment !== 'both') {
          return stage.stage_order > completed.stage_order;
        }
        
        return false;
      });
      
      // 3. Special case: Text stages completing should unlock next Text stages
      const isTextProgression = completedStages.some(completed => 
        completed.part_assignment === 'text' && 
        stage.part_assignment === 'text' &&
        stage.stage_order > completed.stage_order
      );
      
      return isNextSequential || canRunBasedOnParts || isTextProgression;
    });
    
    if (availableStages.length > 0) {
      const stageInfo = availableStages.map(s => ({ name: s.stage_name, part: s.part_assignment, order: s.stage_order }));
      console.log(`🚀 Found ${availableStages.length} available stages after completion:`, stageInfo);
      debugService.logParallelStageTransition(jobId, 'available_after_completion', availableStages.map(s => s.stage_name));
      return availableStages.map(stage => ({
        id: stage.id,
        stage_id: stage.production_stage_id,
        stage_name: stage.stage_name,
        stage_color: stage.stage_color || '#6B7280',
        stage_status: stage.status,
        stage_order: stage.stage_order,
        part_assignment: stage.part_assignment || null
      }));
    }
  }
  
  return [];
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

export const buildDependencyChain = (
  jobStages: any[], 
  jobId: string
): DependencyChain[] => {
  if (!jobStages || jobStages.length === 0) return [];
  
  const dependencies: DependencyChain[] = [];
  const stagesByOrder = jobStages
    .filter(stage => stage.job_id === jobId)
    .sort((a, b) => a.stage_order - b.stage_order);
  
  stagesByOrder.forEach((stage, index) => {
    const predecessors = index > 0 ? [stagesByOrder[index - 1].production_stage_id] : [];
    const successors = index < stagesByOrder.length - 1 ? [stagesByOrder[index + 1].production_stage_id] : [];
    
    dependencies.push({
      job_id: jobId,
      stage_id: stage.production_stage_id,
      predecessor_stage_ids: predecessors,
      successor_stage_ids: successors,
      dependency_type: 'sequential',
      is_critical_path: true, // All stages are critical in linear workflow
      estimated_start_date: stage.started_at ? new Date(stage.started_at) : undefined,
      estimated_completion_date: stage.completed_at ? new Date(stage.completed_at) : undefined
    });
  });
  
  return dependencies;
};

export const findCriticalPath = (dependencies: DependencyChain[]): string[] => {
  // Find the longest path through the dependency chain
  const criticalStages = dependencies
    .filter(dep => dep.is_critical_path)
    .sort((a, b) => (a.estimated_start_date?.getTime() || 0) - (b.estimated_start_date?.getTime() || 0))
    .map(dep => dep.stage_id);
  
  return criticalStages;
};

export const canStageStart = (
  stageId: string, 
  dependencies: DependencyChain[], 
  completedStages: string[]
): boolean => {
  const stageDependency = dependencies.find(dep => dep.stage_id === stageId);
  if (!stageDependency) return true;
  
  // Check if all predecessor stages are completed
  return stageDependency.predecessor_stage_ids.every(predId => 
    completedStages.includes(predId)
  );
};

export const getNextAvailableStages = (
  dependencies: DependencyChain[], 
  completedStages: string[], 
  activeStages: string[]
): string[] => {
  const availableStages = dependencies
    .filter(dep => 
      !completedStages.includes(dep.stage_id) && 
      !activeStages.includes(dep.stage_id) &&
      canStageStart(dep.stage_id, dependencies, completedStages)
    )
    .map(dep => dep.stage_id);
  
  return availableStages;
};