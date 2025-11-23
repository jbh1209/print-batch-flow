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
  if (!jobStages || jobStages.length === 0) {
    return [];
  }
  
  // Debug constant for D428201 tracking
  const d428201JobId = 'fa7a131c-0acf-4f81-a6e1-b438f002119f';
  
  // Get ALL stages for this job (completed, active, pending)
  const allJobStages = jobStages.filter(stage => stage.job_id === jobId);
  
  // Debug: Check if this is D428201 by job_id
  if (jobId === d428201JobId) {
    console.log('[Workflow] D428201 detected by job_id');
    console.log('[Workflow] D428201 all stages:', allJobStages.map(s => ({
      name: s.production_stage?.name,
      order: s.stage_order,
      part: s.part_assignment,
      supports_parts: s.production_stage?.supports_parts,
      status: s.status
    })));
  }
  
  if (allJobStages.length === 0) {
    return [];
  }
  
  // PART-BASED PARALLEL PROCESSING LOGIC
  // Find all pending/active stages (what hasn't been completed yet)
  const pendingStages = allJobStages.filter(stage => 
    stage.status === 'active' || stage.status === 'pending' || stage.status === 'scheduled'
  );
  
  if (pendingStages.length === 0) return [];
  
  // Group pending stages by part_assignment
  const partGroups = {
    cover: pendingStages.filter(s => s.part_assignment === 'cover'),
    text: pendingStages.filter(s => s.part_assignment === 'text'),
    both: pendingStages.filter(s => s.part_assignment === 'both' || !s.part_assignment)
  };
  
  const availableStages: any[] = [];
  
  // For cover: find lowest pending order
  if (partGroups.cover.length > 0) {
    const minOrder = Math.min(...partGroups.cover.map(s => s.stage_order));
    availableStages.push(...partGroups.cover.filter(s => s.stage_order === minOrder));
  }
  
  // For text: find lowest pending order
  if (partGroups.text.length > 0) {
    const minOrder = Math.min(...partGroups.text.map(s => s.stage_order));
    availableStages.push(...partGroups.text.filter(s => s.stage_order === minOrder));
  }
  
  // For both: only if no part-specific stages are pending
  if (partGroups.both.length > 0 && partGroups.cover.length === 0 && partGroups.text.length === 0) {
    const minOrder = Math.min(...partGroups.both.map(s => s.stage_order));
    availableStages.push(...partGroups.both.filter(s => s.stage_order === minOrder));
  }
  
  // Debug: Log available stages for D428201
  if (jobId === d428201JobId) {
    console.log('[Workflow] D428201 part groups:', {
      cover: partGroups.cover.length,
      text: partGroups.text.length,
      both: partGroups.both.length
    });
    console.log('[Workflow] D428201 available stages:', availableStages.map(s => ({
      name: s.production_stage?.name || s.production_stages?.name,
      part: s.part_assignment,
      order: s.stage_order,
      status: s.status
    })));
  }
  
  return availableStages.map(stage => ({
    stage_id: stage.unique_stage_key || stage.production_stage_id,
    stage_name: stage.production_stages?.name || stage.production_stage?.name || stage.stage_name,
    stage_color: stage.production_stages?.color || stage.production_stage?.color || stage.stage_color || '#6B7280',
    stage_status: stage.status,
    stage_order: stage.stage_order,
    unique_stage_key: stage.unique_stage_key,
    production_stage_id: stage.production_stage_id,
    part_assignment: stage.part_assignment
  }));
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