
/**
 * Shared job ordering utilities for consistent sorting across all views
 */

// Extract numeric part from WO number for proper sorting
export const extractWONumber = (woNo: string): number => {
  if (!woNo) return 0;
  const match = woNo.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

// Sort job stages by job_order_in_stage (if set) then by WO number
export const sortJobStagesByOrder = (jobStages: any[]) => {
  return jobStages.sort((a, b) => {
    // Both have explicit order in stage - use that
    if (a.job_order_in_stage && b.job_order_in_stage && 
        a.job_order_in_stage !== 1 && b.job_order_in_stage !== 1) {
      return a.job_order_in_stage - b.job_order_in_stage;
    }
    
    // Only one has explicit order (not default 1) - prioritize it
    if (a.job_order_in_stage && a.job_order_in_stage !== 1 && 
        (!b.job_order_in_stage || b.job_order_in_stage === 1)) {
      return -1;
    }
    if (b.job_order_in_stage && b.job_order_in_stage !== 1 && 
        (!a.job_order_in_stage || a.job_order_in_stage === 1)) {
      return 1;
    }
    
    // Both have default order or no order - sort by WO number
    const aWo = extractWONumber(a.production_job?.wo_no || '');
    const bWo = extractWONumber(b.production_job?.wo_no || '');
    return aWo - bWo;
  });
};

// Sort jobs by WO number (for non-stage contexts)
export const sortJobsByWONumber = (jobs: any[]) => {
  return jobs.sort((a, b) => {
    const aWo = extractWONumber(a.wo_no || '');
    const bWo = extractWONumber(b.wo_no || '');
    return aWo - bWo;
  });
};

// Get next available order position for a stage
export const getNextOrderInStage = (existingJobStages: any[]): number => {
  if (!existingJobStages || existingJobStages.length === 0) return 1;
  
  const maxOrder = Math.max(
    ...existingJobStages.map(js => js.job_order_in_stage || 1)
  );
  return maxOrder + 1;
};
