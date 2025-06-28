
/**
 * Shared job ordering utilities for consistent sorting across all views
 */

// Extract numeric part from WO number for proper sorting
export const extractWONumber = (woNo: string): number => {
  if (!woNo) return 0;
  const match = woNo.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

// Sort job stages by expedite status, then job_order_in_stage, then by WO number
export const sortJobStagesByOrder = (jobStages: any[]) => {
  return jobStages.sort((a, b) => {
    // First priority: Expedited jobs (job_order_in_stage = 0)
    const aIsExpedited = a.job_order_in_stage === 0;
    const bIsExpedited = b.job_order_in_stage === 0;
    
    if (aIsExpedited && !bIsExpedited) return -1;
    if (!aIsExpedited && bIsExpedited) return 1;
    
    // Both expedited - sort by expedited timestamp if available
    if (aIsExpedited && bIsExpedited) {
      const aExpedited = a.production_job?.expedited_at;
      const bExpedited = b.production_job?.expedited_at;
      if (aExpedited && bExpedited) {
        return new Date(aExpedited).getTime() - new Date(bExpedited).getTime();
      }
      // Fall back to WO number for expedited jobs
      const aWo = extractWONumber(a.production_job?.wo_no || '');
      const bWo = extractWONumber(b.production_job?.wo_no || '');
      return aWo - bWo;
    }
    
    // Both have explicit order (not default 1) - use that
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

// Sort jobs by expedite status, then WO number (for non-stage contexts)
export const sortJobsByWONumber = (jobs: any[]) => {
  return jobs.sort((a, b) => {
    // First priority: Expedited jobs
    const aIsExpedited = a.is_expedited === true;
    const bIsExpedited = b.is_expedited === true;
    
    if (aIsExpedited && !bIsExpedited) return -1;
    if (!aIsExpedited && bIsExpedited) return 1;
    
    // Both expedited - sort by expedited timestamp
    if (aIsExpedited && bIsExpedited) {
      const aExpedited = a.expedited_at;
      const bExpedited = b.expedited_at;
      if (aExpedited && bExpedited) {
        return new Date(aExpedited).getTime() - new Date(bExpedited).getTime();
      }
    }
    
    // Sort by WO number
    const aWo = extractWONumber(a.wo_no || '');
    const bWo = extractWONumber(b.wo_no || '');
    return aWo - bWo;
  });
};

// Get next available order position for a stage (considering expedited jobs)
export const getNextOrderInStage = (existingJobStages: any[]): number => {
  if (!existingJobStages || existingJobStages.length === 0) return 1;
  
  // Find the highest non-expedited order
  const nonExpeditedOrders = existingJobStages
    .filter(js => js.job_order_in_stage > 0)
    .map(js => js.job_order_in_stage);
  
  if (nonExpeditedOrders.length === 0) return 1;
  
  const maxOrder = Math.max(...nonExpeditedOrders);
  return maxOrder + 1;
};

// Check if a job should be considered expedited based on its stage order
export const isJobExpedited = (jobStage: any): boolean => {
  return jobStage.job_order_in_stage === 0;
};
