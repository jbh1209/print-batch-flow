// Utility functions for handling parallel/concurrent stages and dependency chains

export interface ParallelStageInfo {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_status: string;
  stage_order: number;
  unique_stage_key?: string;
  production_stage_id?: string;
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
  
  // Find all active/pending stages for this job
  const activeStages = jobStages.filter(stage => 
    stage.job_id === jobId && 
    (stage.status === 'active' || stage.status === 'pending')
  );
  
  if (activeStages.length === 0) return [];
  
  // Group stages by whether they support parts
  const partBasedStages = activeStages.filter(stage => 
    stage.production_stages?.supports_parts === true
  );
  
  const sequentialStages = activeStages.filter(stage => 
    !stage.production_stages?.supports_parts
  );
  
  const availableStages: any[] = [];
  
  // For part-based stages, group by part assignment and find next available stage per part
  if (partBasedStages.length > 0) {
    const partGroups = partBasedStages.reduce((groups, stage) => {
      const partKey = stage.part_assignment || 'both';
      if (!groups[partKey]) groups[partKey] = [];
      groups[partKey].push(stage);
      return groups;
    }, {} as Record<string, any[]>);
    
    // For each part, find the next available stage(s)
    Object.values(partGroups).forEach((partStages: any[]) => {
      const minOrder = Math.min(...partStages.map((s: any) => s.stage_order));
      const nextStages = partStages.filter((stage: any) => stage.stage_order === minOrder);
      availableStages.push(...nextStages);
    });
  }
  
  // For sequential stages, use minimum order logic
  if (sequentialStages.length > 0) {
    const minOrder = Math.min(...sequentialStages.map(s => s.stage_order));
    const nextSequentialStages = sequentialStages.filter(stage => stage.stage_order === minOrder);
    availableStages.push(...nextSequentialStages);
  }
  
  // Return mapped stage info with unique identifiers
  return availableStages.map(stage => ({
    stage_id: stage.unique_stage_key || stage.production_stage_id,
    stage_name: stage.production_stages?.name || stage.stage_name,
    stage_color: stage.production_stages?.color || stage.stage_color || '#6B7280',
    stage_status: stage.status,
    stage_order: stage.stage_order,
    unique_stage_key: stage.unique_stage_key,
    production_stage_id: stage.production_stage_id
  }));
};

export const shouldJobAppearInStage = (
  parallelStages: ParallelStageInfo[],
  targetStageId: string
): boolean => {
  return parallelStages.some(stage => 
    stage.stage_id === targetStageId || 
    stage.production_stage_id === targetStageId ||
    stage.unique_stage_key === targetStageId
  );
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