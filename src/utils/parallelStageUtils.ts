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
  
  // Get all stages for this job (active, pending, completed)
  const allJobStages = jobStages.filter(stage => stage.job_id === jobId);
  
  if (allJobStages.length === 0) return [];
  
  // Get completed stages to check prerequisites
  const completedStages = allJobStages.filter(stage => stage.status === 'completed');
  const completedStageOrders = completedStages.map(stage => stage.stage_order);
  
  // Get active and pending stages
  const activeOrPendingStages = allJobStages.filter(stage => 
    stage.status === 'active' || stage.status === 'pending'
  );
  
  if (activeOrPendingStages.length === 0) return [];
  
  console.log(`[Stage Debug] Job ${jobId}:`, {
    totalStages: allJobStages.length,
    completedOrders: completedStageOrders,
    activeOrPending: activeOrPendingStages.map(s => ({ order: s.stage_order, status: s.status, name: s.production_stages?.name }))
  });
  
  // Check if all prerequisite stages are completed for a given stage order
  const checkStagePrerequisites = (targetOrder: number, completedOrders: number[], allStages: any[]): boolean => {
    // Get all unique stage orders that should be completed before this stage
    const allStageOrders = [...new Set(allStages.map(s => s.stage_order))].sort((a, b) => a - b);
    const requiredOrders = allStageOrders.filter(order => order < targetOrder);
    
    // All required orders must have at least one completed stage
    return requiredOrders.every(requiredOrder => completedOrders.includes(requiredOrder));
  };

  // Find the next available stages based on sequential dependencies
  const availableStages: any[] = [];
  
  // Group stages by supports_parts flag
  const partSupportingStages = activeOrPendingStages.filter(stage => 
    stage.production_stages?.supports_parts
  );
  
  const sequentialStages = activeOrPendingStages.filter(stage => 
    !stage.production_stages?.supports_parts
  );
  
  // For sequential stages (like DTP, PROOF, Batch Allocation)
  if (sequentialStages.length > 0) {
    const minSequentialOrder = Math.min(...sequentialStages.map(s => s.stage_order));
    
    // Check if all lower order stages are completed
    const hasPrerequisites = checkStagePrerequisites(minSequentialOrder, completedStageOrders, allJobStages);
    
    if (hasPrerequisites) {
      const nextSequentialStages = sequentialStages.filter(stage => stage.stage_order === minSequentialOrder);
      availableStages.push(...nextSequentialStages);
      console.log(`[Stage Debug] Sequential stages available:`, nextSequentialStages.map(s => s.production_stages?.name));
    } else {
      console.log(`[Stage Debug] Sequential stage order ${minSequentialOrder} blocked - prerequisites not met`);
    }
  }
  
  // For part-supporting stages (like HP 12000, T250) - only if no sequential stages are pending
  if (partSupportingStages.length > 0 && availableStages.length === 0) {
    const partStageOrder = Math.min(...partSupportingStages.map(s => s.stage_order));
    
    // Check if all lower order stages are completed
    const hasPrerequisites = checkStagePrerequisites(partStageOrder, completedStageOrders, allJobStages);
    
    if (hasPrerequisites) {
      // Group by part assignment for parallel processing
      const partGroups = partSupportingStages
        .filter(stage => stage.stage_order === partStageOrder)
        .reduce((groups, stage) => {
          const partKey = stage.part_assignment || 'both';
          if (!groups[partKey]) groups[partKey] = [];
          groups[partKey].push(stage);
          return groups;
        }, {} as Record<string, any[]>);
      
      // For printing stages, allow parallel processing for different part assignments
      const activePrintingStages = allJobStages.filter(stage => 
        stage.status === 'active' && stage.production_stages?.supports_parts
      );
      
      if (activePrintingStages.length === 0) {
        // No printing stages active - allow all parallel options
        Object.values(partGroups).forEach((partStages: any[]) => {
          availableStages.push(...partStages);
        });
        console.log(`[Stage Debug] Part-supporting stages available:`, availableStages.map(s => s.production_stages?.name));
      } else {
        // Some printing stages are active - show available stages for each part assignment
        const activePartAssignments = new Set(activePrintingStages.map(stage => stage.part_assignment || 'both'));
        
        Object.entries(partGroups).forEach(([partKey, partStages]: [string, any[]]) => {
          if (!activePartAssignments.has(partKey)) {
            // This part assignment has no active stages - show all options for this part
            availableStages.push(...partStages);
          } else {
            // This part assignment has active stages - only show the active ones
            const activeStagesForPart = activePrintingStages.filter(stage => 
              (stage.part_assignment || 'both') === partKey
            );
            availableStages.push(...activeStagesForPart);
          }
        });
        
        console.log(`[Stage Debug] Parallel printing stages by part:`, {
          activeAssignments: Array.from(activePartAssignments),
          availableStages: availableStages.map(s => ({ 
            name: s.production_stages?.name, 
            part: s.part_assignment || 'both' 
          }))
        });
      }
    } else {
      console.log(`[Stage Debug] Part-supporting stage order ${partStageOrder} blocked - prerequisites not met`);
    }
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