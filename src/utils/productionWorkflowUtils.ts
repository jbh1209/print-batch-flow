/**
 * PRODUCTION WORKFLOW UTILITIES
 * 
 * This file contains utility functions specifically for the Production Workflow Board.
 * These functions determine which jobs should appear in which stages for operators
 * to work on currently (showing the CURRENT actionable stages).
 * 
 * DO NOT modify these functions for scheduling purposes - use schedulingUtils.ts instead.
 */

export interface WorkflowStageInfo {
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

export interface WorkflowJobData {
  job_id: string;
  wo_no: string;
  workflow_stages: WorkflowStageInfo[];
  current_stage_order?: number;
  critical_path?: string[];
}

/**
 * Get the current actionable stages for a job in the Production Workflow.
 * This function shows where operators can work RIGHT NOW.
 * 
 * @param jobStages - All job stage instances for the job
 * @param jobId - The job ID to analyze
 * @returns Array of stages where this job should appear for workflow purposes
 */
export const getJobWorkflowStages = (
  jobStages: any[], 
  jobId: string
): WorkflowStageInfo[] => {
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
  
  // Always include pending/active PROOF stages regardless of phase logic
  const proofStages = pendingStages.filter(stage => 
    stage.production_stages?.name?.toLowerCase().includes('proof') ||
    stage.stage_name?.toLowerCase().includes('proof')
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
      
      // Combine next sequential stages with proof stages
      const combinedStages = [...nextStages, ...proofStages];
      
      return combinedStages.map(stage => ({
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
    
    // Always include proof stages in parallel phase too
    availableStages.push(...proofStages);
    
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
    
    // Always include proof stages in fallback too
    const combinedStages = [...firstStages, ...proofStages];
    
    return combinedStages.map(stage => ({
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

/**
 * Check if a job should appear in a specific workflow stage.
 * Used by Production Workflow Board to filter jobs by stage.
 */
export const shouldJobAppearInWorkflowStage = (
  workflowStages: WorkflowStageInfo[],
  targetStageId: string
): boolean => {
  return workflowStages.some(stage => 
    stage.stage_id === targetStageId || 
    stage.production_stage_id === targetStageId ||
    stage.unique_stage_key === targetStageId
  );
};

/**
 * Get all jobs that should appear in a specific workflow stage.
 * Used by Production Workflow Board stage columns.
 */
export const getJobsForWorkflowStage = (
  jobs: any[],
  jobStagesMap: Map<string, any[]>,
  stageId: string
): any[] => {
  return jobs.filter(job => {
    const jobStages = jobStagesMap.get(job.job_id) || [];
    const workflowStages = getJobWorkflowStages(jobStages, job.job_id);
    return shouldJobAppearInWorkflowStage(workflowStages, stageId);
  });
};