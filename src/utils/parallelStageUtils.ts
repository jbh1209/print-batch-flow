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
  
  // For part-supporting stages (like HP 12000, T250) - process ALL order levels independently
  if (partSupportingStages.length > 0) {
    // Group part-supporting stages by order level
    const stagesByOrder = partSupportingStages.reduce((orders, stage) => {
      const order = stage.stage_order;
      if (!orders[order]) orders[order] = [];
      orders[order].push(stage);
      return orders;
    }, {} as Record<number, any[]>);
    
    // Get all completed part assignments per order for prerequisite checking
    const completedPartsByOrder = allJobStages
      .filter(stage => stage.status === 'completed' && stage.production_stages?.supports_parts)
      .reduce((byOrder, stage) => {
        const order = stage.stage_order;
        if (!byOrder[order]) byOrder[order] = new Set();
        byOrder[order].add(stage.part_assignment || 'both');
        return byOrder;
      }, {} as Record<number, Set<string>>);
    
    // Get currently active part assignments per order
    const activePartsByOrder = allJobStages
      .filter(stage => stage.status === 'active' && stage.production_stages?.supports_parts)
      .reduce((byOrder, stage) => {
        const order = stage.stage_order;
        if (!byOrder[order]) byOrder[order] = new Set();
        byOrder[order].add(stage.part_assignment || 'both');
        return byOrder;
      }, {} as Record<number, Set<string>>);
    
    console.log(`[Stage Debug] Multi-order part processing:`, {
      orderLevels: Object.keys(stagesByOrder).map(Number).sort((a, b) => a - b),
      completedByOrder: Object.fromEntries(
        Object.entries(completedPartsByOrder).map(([order, parts]) => [order, Array.from(parts as Set<string>)])
      ),
      activeByOrder: Object.fromEntries(
        Object.entries(activePartsByOrder).map(([order, parts]) => [order, Array.from(parts as Set<string>)])
      )
    });
    
    // Process each order level independently
    Object.entries(stagesByOrder)
      .map(([orderStr, stages]) => [Number(orderStr), stages] as [number, any[]])
      .sort(([a], [b]) => a - b) // Process in order
      .forEach(([currentOrder, stagesAtOrder]) => {
        
        // Check if all lower order stages are completed for this order level
        const hasPrerequisites = checkStagePrerequisites(currentOrder, completedStageOrders, allJobStages);
        
        if (!hasPrerequisites) {
          console.log(`[Stage Debug] Order ${currentOrder} blocked - prerequisites not met`);
          return;
        }
        
        // Group stages by part assignment for this order
        const partGroups = stagesAtOrder.reduce((groups, stage) => {
          const partKey = stage.part_assignment || 'both';
          if (!groups[partKey]) groups[partKey] = [];
          groups[partKey].push(stage);
          return groups;
        }, {} as Record<string, any[]>);
        
        const activePartsAtOrder = activePartsByOrder[currentOrder] || new Set();
        const completedPartsAtOrder = completedPartsByOrder[currentOrder] || new Set();
        
        // Simplified part prerequisite checking - focus on direct order progression
        const checkPartPrerequisites = (partAssignment: string, targetOrder: number): boolean => {
          if (partAssignment === 'both') {
            // For 'both' stages, check if both text and cover have completed their immediate previous order
            const requiredParts = ['text', 'cover'];
            return requiredParts.every(part => {
              const partCompletedOrders = Object.entries(completedPartsByOrder)
                .filter(([, parts]) => (parts as Set<string>).has(part))
                .map(([order]) => Number(order));
              
              if (partCompletedOrders.length === 0) {
                // If no completed orders for this part, check if this is the first order
                const allOrdersForPart = Object.entries(stagesByOrder)
                  .filter(([, stages]) => 
                    (stages as any[]).some(s => (s.part_assignment || 'both') === part || (s.part_assignment || 'both') === 'both')
                  )
                  .map(([order]) => Number(order))
                  .sort((a, b) => a - b);
                
                return allOrdersForPart.length === 0 || allOrdersForPart[0] === targetOrder;
              }
              
              const highestCompletedOrder = Math.max(...partCompletedOrders);
              return highestCompletedOrder >= targetOrder - 1; // Simple progression check
            });
          } else {
            // For specific part stages, check if this part has progressed properly
            const partCompletedOrders = Object.entries(completedPartsByOrder)
              .filter(([, parts]) => (parts as Set<string>).has(partAssignment))
              .map(([order]) => Number(order));
            
            if (partCompletedOrders.length === 0) {
              // If no completed orders for this part, this could be the first available order
              return true;
            }
            
            const highestCompletedOrder = Math.max(...partCompletedOrders);
            // Allow progression to next available order for this part
            return true;
          }
        };
        
        // Process each part group at this order
        Object.entries(partGroups).forEach(([partKey, partStages]: [string, any[]]) => {
          const hasPartPrerequisites = checkPartPrerequisites(partKey, currentOrder);
          
          if (!hasPartPrerequisites) {
            console.log(`[Stage Debug] Part ${partKey} at order ${currentOrder} blocked - part prerequisites not met`);
            return;
          }
          
          if (activePartsAtOrder.has(partKey)) {
            // This part has active stages at this order - show them
            const activeStagesForPart = allJobStages.filter(stage => 
              stage.status === 'active' && 
              stage.stage_order === currentOrder &&
              (stage.part_assignment || 'both') === partKey
            );
            availableStages.push(...activeStagesForPart);
            console.log(`[Stage Debug] Active stages for ${partKey} at order ${currentOrder}:`, 
              activeStagesForPart.map(s => s.production_stages?.name));
          } else if (!completedPartsAtOrder.has(partKey)) {
            // This part has no active stages and is not completed at this order - show available stages
            availableStages.push(...partStages);
            console.log(`[Stage Debug] Available stages for ${partKey} at order ${currentOrder}:`, 
              partStages.map(s => s.production_stages?.name));
          } else {
            console.log(`[Stage Debug] Part ${partKey} completed at order ${currentOrder} - skipping`);
          }
        });
      });
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