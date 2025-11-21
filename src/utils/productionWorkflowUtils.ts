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
  
  // Group stages by type - normalize supports_parts check
  const partBasedStages = allJobStages.filter(stage => {
    const supportsParts = 
      stage.production_stages?.supports_parts ?? 
      stage.production_stage?.supports_parts ?? 
      stage.supports_parts ?? 
      false;
    return supportsParts === true;
  });
  const sequentialStages = allJobStages.filter(stage => {
    const supportsParts = 
      stage.production_stages?.supports_parts ?? 
      stage.production_stage?.supports_parts ?? 
      stage.supports_parts ?? 
      false;
    return !supportsParts;
  });
  
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
  // Trust the scheduler's output - it already calculated parallel processing correctly
  if (allPrerequisitesComplete && pendingPartBasedStages.length > 0) {
    console.log('[Workflow]', jobId, 'Parallel phase - trusting scheduler output');
    const availableStages: any[] = [];
    
    // Group pending stages by part assignment
    const pendingPartGroups = pendingPartBasedStages.reduce((groups, stage) => {
      const partKey = stage.part_assignment || 'both';
      if (!groups[partKey]) groups[partKey] = [];
      groups[partKey].push(stage);
      return groups;
    }, {} as Record<string, any[]>);
    
    console.log('[Workflow]', jobId, 'Pending part groups:', Object.keys(pendingPartGroups));
    
    // For cover and text: return the LOWEST pending stage_order (scheduler already determined independence)
    ['cover', 'text'].forEach(partKey => {
      if (pendingPartGroups[partKey]?.length > 0) {
        const minOrder = Math.min(...pendingPartGroups[partKey].map(s => s.stage_order));
        const nextStages = pendingPartGroups[partKey].filter(s => s.stage_order === minOrder);
        console.log('[Workflow]', jobId, `Part ${partKey}: next stage order ${minOrder}, stages:`, nextStages.map(s => s.production_stages?.name || s.stage_name));
        availableStages.push(...nextStages);
      }
    });
    
    // For "both": only include if no lower-order part-specific stages exist (merge point logic)
    if (pendingPartGroups['both']?.length > 0) {
      const coverTextStages = [...(pendingPartGroups['cover'] || []), ...(pendingPartGroups['text'] || [])];
      const lowestPartOrder = coverTextStages.length > 0 
        ? Math.min(...coverTextStages.map(s => s.stage_order))
        : Infinity;
      
      const lowestBothOrder = Math.min(...pendingPartGroups['both'].map(s => s.stage_order));
      
      // Only include "both" stages if all part-specific work at lower orders is complete
      if (lowestBothOrder < lowestPartOrder || !isFinite(lowestPartOrder)) {
        const nextBothStages = pendingPartGroups['both'].filter(s => s.stage_order === lowestBothOrder);
        console.log('[Workflow]', jobId, `Part "both": merge point at order ${lowestBothOrder}, stages:`, nextBothStages.map(s => s.production_stages?.name || s.stage_name));
        availableStages.push(...nextBothStages);
      } else {
        console.log('[Workflow]', jobId, `Part "both": waiting for part-specific stages (lowestPartOrder: ${lowestPartOrder}, lowestBothOrder: ${lowestBothOrder})`);
      }
    }
    
    if (availableStages.length > 0) {
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