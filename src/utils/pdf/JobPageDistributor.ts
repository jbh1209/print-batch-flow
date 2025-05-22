
import { Job as BusinessCardJob } from "@/components/business-cards/JobsTable";

interface JobPageAllocation {
  jobId: string;
  jobName: string;
  totalQuantity: number;
  slotsNeeded: number;
  quantityPerSlot: number;
  isDoubleSided: boolean;
}

/**
 * Calculates how many slots each job needs based on quantity and available slots
 */
export function calculateJobPageDistribution(
  jobs: any[],
  totalAvailableSlots: number
): JobPageAllocation[] {
  console.log(`Calculating job distribution for ${jobs.length} jobs with ${totalAvailableSlots} total slots`);
  
  // Calculate total quantity needed for all jobs
  const totalQuantity = jobs.reduce((sum, job) => sum + job.quantity, 0);
  console.log(`Total cards to print: ${totalQuantity}`);
  
  // Calculate how many slots each job would need if we distribute proportionally
  // but ensure each job gets at least one slot
  const jobAllocations: JobPageAllocation[] = [];
  
  for (const job of jobs) {
    // Calculate the proportion of slots this job should get
    const proportion = job.quantity / totalQuantity;
    // Initial slot allocation based on proportion, minimum 1
    let slotsNeeded = Math.max(1, Math.round(proportion * totalAvailableSlots));
    
    // Calculate cards per slot
    let quantityPerSlot = Math.ceil(job.quantity / slotsNeeded);
    
    // If quantity per slot is less than a minimum threshold (e.g., 5), 
    // reduce the number of slots to avoid wastage
    const minimumCardsPerSlot = 5;
    if (quantityPerSlot < minimumCardsPerSlot && slotsNeeded > 1) {
      slotsNeeded = Math.ceil(job.quantity / minimumCardsPerSlot);
      quantityPerSlot = Math.ceil(job.quantity / slotsNeeded);
    }
    
    // Explicitly log the double_sided value for debugging
    const isDoubleSided = job.double_sided === true;
    console.log(`Job "${job.name}" (${job.id}): double_sided = ${isDoubleSided ? "YES" : "NO"}`);
    
    jobAllocations.push({
      jobId: job.id,
      jobName: job.name,
      totalQuantity: job.quantity,
      slotsNeeded,
      quantityPerSlot,
      isDoubleSided: isDoubleSided
    });
    
    console.log(`Job "${job.name}" (${job.id}): ${job.quantity} cards → ${slotsNeeded} slots with ${quantityPerSlot} cards per slot (double-sided: ${isDoubleSided})`);
  }
  
  // Optimize allocations to fit within total slots
  const totalSlotsAllocated = jobAllocations.reduce((sum, job) => sum + job.slotsNeeded, 0);
  
  if (totalSlotsAllocated > totalAvailableSlots) {
    console.log(`Warning: Initial allocation (${totalSlotsAllocated}) exceeds available slots (${totalAvailableSlots}). Adjusting...`);
    
    // Sort by quantity per slot descending (prioritize jobs with higher density)
    const sortedAllocations = [...jobAllocations].sort((a, b) => 
      b.quantityPerSlot - a.quantityPerSlot
    );
    
    // First pass: try to reduce slots from jobs with lowest density
    while (
      jobAllocations.reduce((sum, job) => sum + job.slotsNeeded, 0) > totalAvailableSlots
    ) {
      // Find job with lowest quantity per slot that has more than 1 slot
      const reducibleJobs = sortedAllocations
        .filter(job => job.slotsNeeded > 1)
        .sort((a, b) => a.quantityPerSlot - b.quantityPerSlot);
      
      if (reducibleJobs.length === 0) break; // Can't reduce any further
      
      // Reduce slots from the job with lowest density
      const jobToReduce = reducibleJobs[0];
      jobToReduce.slotsNeeded -= 1;
      jobToReduce.quantityPerSlot = Math.ceil(jobToReduce.totalQuantity / jobToReduce.slotsNeeded);
      
      console.log(`Reduced slots for "${jobToReduce.jobName}" to ${jobToReduce.slotsNeeded} (${jobToReduce.quantityPerSlot} cards/slot)`);
    }
    
    // If we still have too many slots, proportionally reduce all jobs
    const adjustedTotalSlots = jobAllocations.reduce((sum, job) => sum + job.slotsNeeded, 0);
    if (adjustedTotalSlots > totalAvailableSlots) {
      console.log(`Still over capacity after first adjustment. Applying proportional reduction...`);
      
      const reductionFactor = totalAvailableSlots / adjustedTotalSlots;
      
      for (const job of jobAllocations) {
        const originalSlots = job.slotsNeeded;
        job.slotsNeeded = Math.max(1, Math.floor(job.slotsNeeded * reductionFactor));
        job.quantityPerSlot = Math.ceil(job.totalQuantity / job.slotsNeeded);
        
        console.log(`Adjusted "${job.jobName}": ${originalSlots} → ${job.slotsNeeded} slots (${job.quantityPerSlot} cards/slot)`);
      }
    }
  }
  
  // Final validation
  const finalTotalSlots = jobAllocations.reduce((sum, job) => sum + job.slotsNeeded, 0);
  console.log(`Final allocation: ${finalTotalSlots}/${totalAvailableSlots} slots used`);
  
  return jobAllocations;
}

export default calculateJobPageDistribution;
