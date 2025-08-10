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
  
  // Get ALL stages for this job (completed, active, pending)
  const allJobStages = jobStages.filter(stage => stage.job_id === jobId);
  if (allJobStages.length === 0) return [];
  
  // Separate stages by status
  const completedStages = allJobStages.filter(stage => stage.status === 'completed');
  const pendingStages = allJobStages.filter(stage => 
    stage.status === 'active' || stage.status === 'pending'
  );
  
  if (pendingStages.length === 0) return [];
  
  // Find the highest completed stage order across ALL stages
  const highestCompletedOrder = completedStages.length > 0 
    ? Math.max(...completedStages.map(s => s.stage_order))
    : -1;
  
  // Group stages by type
  const partBasedStages = allJobStages.filter(stage => 
    stage.production_stages?.supports_parts === true
  );
  const sequentialStages = allJobStages.filter(stage => 
    !stage.production_stages?.supports_parts
  );
  
  // Determine current workflow phase
  const pendingPartBasedStages = partBasedStages.filter(s => 
    s.status === 'active' || s.status === 'pending'
  );
  const pendingSequentialStages = sequentialStages.filter(s => 
    s.status === 'active' || s.status === 'pending'
  );
  
  // Determine if all prerequisite sequential stages are complete
  // Find the minimum stage order among part-based stages (parallel work start point)
  const parallelWorkStartOrder = partBasedStages.length > 0 
    ? Math.min(...partBasedStages.map(s => s.stage_order))
    : Infinity;
  
  // Find all sequential stages that come BEFORE parallel work
  const prerequisiteSequentialStages = sequentialStages.filter(s => 
    s.stage_order < parallelWorkStartOrder
  );
  
  // Check if all prerequisite sequential stages are completed
  const allPrerequisitesComplete = prerequisiteSequentialStages.every(s => 
    s.status === 'completed'
  );
  
  // PHASE LOGIC: Only return stages from ONE phase at a time
  
  // PHASE 1: Sequential stages BEFORE parallel work (must complete first)
  if (!allPrerequisitesComplete && pendingSequentialStages.length > 0) {
    // Find next sequential stage after highest completed
    const nextSequentialStages = pendingSequentialStages.filter(s => 
      s.stage_order > highestCompletedOrder
    );
    
    if (nextSequentialStages.length > 0) {
      const minNextOrder = Math.min(...nextSequentialStages.map(s => s.stage_order));
      const nextStages = nextSequentialStages.filter(s => s.stage_order === minNextOrder);
      
      return nextStages.map(stage => ({
        stage_id: stage.unique_stage_key || stage.production_stage_id,
        stage_name: stage.production_stages?.name || stage.stage_name,
        stage_color: stage.production_stages?.color || stage.stage_color || '#6B7280',
        stage_status: stage.status,
        stage_order: stage.stage_order,
        unique_stage_key: stage.unique_stage_key,
        production_stage_id: stage.production_stage_id
      }));
    }
  }
  
  // PHASE 2: Parallel part-based stages (only when prerequisites complete)
  if (allPrerequisitesComplete && pendingPartBasedStages.length > 0) {
    const availableStages: any[] = [];
    
    // Group part-based stages by part assignment
    const partGroups = partBasedStages.reduce((groups, stage) => {
      const partKey = stage.part_assignment || 'both';
      if (!groups[partKey]) groups[partKey] = [];
      groups[partKey].push(stage);
      return groups;
    }, {} as Record<string, any[]>);
    
    // For each part, find the next available stage
    Object.entries(partGroups).forEach(([partKey, partStages]: [string, any[]]) => {
      const completedPartStages = partStages.filter(s => s.status === 'completed');
      const pendingPartStages = partStages.filter(s => s.status === 'active' || s.status === 'pending');
      
      if (pendingPartStages.length === 0) return;
      
      // Find highest completed order for this specific part
      const partHighestCompleted = completedPartStages.length > 0 
        ? Math.max(...completedPartStages.map(s => s.stage_order))
        : highestCompletedOrder; // Use global highest if no part-specific completed stages
      
      // Find next pending stage for this part after its highest completed
      const nextPartStages = pendingPartStages.filter(s => s.stage_order > partHighestCompleted);
      
      if (nextPartStages.length > 0) {
        const minOrder = Math.min(...nextPartStages.map(s => s.stage_order));
        const nextStages = nextPartStages.filter(s => s.stage_order === minOrder);
        availableStages.push(...nextStages);
      }
    });
    
    return availableStages.map(stage => ({
      stage_id: stage.unique_stage_key || stage.production_stage_id,
      stage_name: stage.production_stages?.name || stage.stage_name,
      stage_color: stage.production_stages?.color || stage.stage_color || '#6B7280',
      stage_status: stage.status,
      stage_order: stage.stage_order,
      unique_stage_key: stage.unique_stage_key,
      production_stage_id: stage.production_stage_id
    }));
  }
  
  // Fallback: Return first pending stage if no logic applies
  if (pendingStages.length > 0) {
    const minOrder = Math.min(...pendingStages.map(s => s.stage_order));
    const firstStages = pendingStages.filter(s => s.stage_order === minOrder);
    
    return firstStages.map(stage => ({
      stage_id: stage.unique_stage_key || stage.production_stage_id,
      stage_name: stage.production_stages?.name || stage.stage_name,
      stage_color: stage.production_stages?.color || stage.stage_color || '#6B7280',
      stage_status: stage.status,
      stage_order: stage.stage_order,
      unique_stage_key: stage.unique_stage_key,
      production_stage_id: stage.production_stage_id
    }));
  }
  
  return [];
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