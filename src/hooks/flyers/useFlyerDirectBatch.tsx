
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';

export interface BatchValidationResult {
  isValid: boolean;
  error: string | null;
  warnings?: string[];
}

export interface AutoBatchProperties {
  paperType: string;
  paperWeight: string;
  laminationType: LaminationType;
  printerType: string;
  sheetSize: string;
  slaTargetDays: number;
}

export const useFlyerDirectBatch = () => {
  
  // Validate that all jobs can be batched together
  const validateJobsForBatching = (jobs: FlyerJob[]): BatchValidationResult => {
    if (jobs.length === 0) {
      return { isValid: false, error: "No jobs selected for batching" };
    }

    if (jobs.length === 1) {
      return { 
        isValid: true, 
        error: null, 
        warnings: ["Creating batch with single job"] 
      };
    }

    // Since specifications are now stored centrally, we can't directly compare
    // paper_type and paper_weight from the job objects. 
    // For now, we'll allow all jobs to be batched together with a warning
    // about mixed specifications if needed.
    
    return { 
      isValid: true, 
      error: null, 
      warnings: ["Job specifications will be validated during batch creation"] 
    };
  };

  // Auto-determine batch properties from selected jobs
  const determineBatchProperties = (jobs: FlyerJob[]): AutoBatchProperties => {
    // Since specifications are now centralized, we'll use defaults
    return {
      paperType: 'Standard Paper',
      paperWeight: 'Standard Weight',
      laminationType: 'none' as const, // Default for flyers
      printerType: 'HP 12000', // Default printer
      sheetSize: '530x750mm', // Standard sheet size
      slaTargetDays: 3 // Default SLA for flyers from product config
    };
  };

  // Generate batch summary for user feedback
  const generateBatchSummary = (jobs: FlyerJob[], properties: AutoBatchProperties) => {
    const totalQuantity = jobs.reduce((sum, job) => sum + job.quantity, 0);
    const earliestDueDate = jobs.reduce((earliest, job) => {
      const jobDate = new Date(job.due_date);
      return jobDate < earliest ? jobDate : earliest;
    }, new Date(jobs[0].due_date));

    return {
      jobCount: jobs.length,
      totalQuantity,
      sizes: 'Various Sizes', // Since sizes are now dynamic
      paperSpec: `${properties.paperType} ${properties.paperWeight}`,
      earliestDueDate: earliestDueDate.toLocaleDateString(),
      estimatedSheets: Math.ceil(totalQuantity / 2) // Rough estimate for A5 flyers
    };
  };

  return {
    validateJobsForBatching,
    determineBatchProperties,
    generateBatchSummary
  };
};
