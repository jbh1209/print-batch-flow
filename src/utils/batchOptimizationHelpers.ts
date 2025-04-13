
import { Job } from "@/components/business-cards/JobsTable";

// Constants
export const SLOTS_PER_SHEET = 24;
export const MIN_RECOMMENDED_JOBS = 6;
export const MIN_PRINT_HOURS_BEFORE_DUE = 36;

/**
 * Determines if a batch should be recommended based on:
 * - At least MIN_RECOMMENDED_JOBS jobs are available
 * - At least one job is approaching its due date (< MIN_PRINT_HOURS_BEFORE_DUE hours away)
 */
export function shouldRecommendBatch(jobs: Job[]): boolean {
  if (jobs.length < MIN_RECOMMENDED_JOBS) {
    return false;
  }
  
  // Check if any jobs are approaching their due date
  const now = new Date();
  const hoursBeforeDueDate = MIN_PRINT_HOURS_BEFORE_DUE;
  
  return jobs.some(job => {
    const dueDate = new Date(job.due_date);
    const hoursDifference = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDifference <= hoursBeforeDueDate;
  });
}

/**
 * Calculate the optimal distribution of jobs on sheets
 * to minimize the number of sheets required
 */
export function calculateOptimalDistribution(selectedJobs: Job[]): BatchOptimization {
  // Calculate the total quantity needed for all jobs
  const totalCards = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
  
  // Simple case: just divide by 24 and round up
  let minimumSheetsRequired = Math.ceil(totalCards / SLOTS_PER_SHEET);
  
  // Calculate how many slots each job would need
  const jobDistribution = selectedJobs.map(job => {
    // Calculate slots needed based on job quantity and sheet count
    const slotsNeeded = Math.ceil((job.quantity / minimumSheetsRequired) / SLOTS_PER_SHEET * 24);
    
    return {
      job,
      slotsNeeded,
      quantityPerSlot: Math.ceil(job.quantity / slotsNeeded)
    };
  });
  
  // Advanced optimization algorithm
  // Try to optimize sheet utilization by adjusting slot distribution
  const optimizedDistribution = optimizeSlotDistribution(jobDistribution, minimumSheetsRequired);
  
  // Calculate actual slots used
  const slotsUsed = optimizedDistribution.reduce((sum, item) => sum + item.slotsNeeded, 0);
  const slotUtilization = Math.min(100, (slotsUsed / SLOTS_PER_SHEET) * 100);
  
  return {
    sheetsRequired: minimumSheetsRequired,
    distribution: optimizedDistribution,
    slotUtilization,
    totalCards
  };
}

// Helper function for advanced slot optimization
function optimizeSlotDistribution(
  initialDistribution: JobDistributionItem[],
  sheetCount: number
): JobDistributionItem[] {
  // Sort by quantity descending for better distribution
  const sortedJobs = [...initialDistribution].sort(
    (a, b) => b.job.quantity - a.job.quantity
  );
  
  // Try to balance slots better
  let remainingSlots = SLOTS_PER_SHEET;
  const optimized: JobDistributionItem[] = [];
  
  // First pass - handle large jobs
  for (const jobItem of sortedJobs) {
    // Calculate how many sheets worth of this job we need
    const { job } = jobItem;
    
    // Calculate optimal slots based on job's percentage of total quantity
    let optimizedSlots = Math.min(
      Math.ceil(job.quantity / sheetCount),
      remainingSlots
    );
    
    // Ensure we assign at least 1 slot
    optimizedSlots = Math.max(1, optimizedSlots);
    
    optimized.push({
      job,
      slotsNeeded: optimizedSlots,
      quantityPerSlot: Math.ceil(job.quantity / optimizedSlots)
    });
    
    remainingSlots -= optimizedSlots;
    
    // If we've used all slots, we're done
    if (remainingSlots <= 0) break;
  }
  
  return optimized;
}

// Types for batch optimization
export interface JobDistributionItem {
  job: Job;
  slotsNeeded: number;
  quantityPerSlot: number;
}

export interface BatchOptimization {
  sheetsRequired: number;
  distribution: JobDistributionItem[];
  slotUtilization: number;
  totalCards: number;
}
