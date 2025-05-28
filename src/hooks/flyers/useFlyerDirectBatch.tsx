
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

    const firstJob = jobs[0];
    const incompatibleJobs = jobs.filter(job => 
      job.paper_type !== firstJob.paper_type || 
      job.paper_weight !== firstJob.paper_weight
    );

    if (incompatibleJobs.length > 0) {
      const incompatibleDetails = incompatibleJobs.map(job => 
        `${job.name} (${job.paper_type} ${job.paper_weight})`
      ).join(', ');
      
      return { 
        isValid: false, 
        error: `Cannot batch jobs with different specifications. Expected: ${firstJob.paper_type} ${firstJob.paper_weight}. Incompatible jobs: ${incompatibleDetails}` 
      };
    }

    // Check for mixed sizes (warning, not error)
    const sizes = [...new Set(jobs.map(job => job.size))];
    const warnings = sizes.length > 1 ? 
      [`Mixed sizes detected: ${sizes.join(', ')}. Verify imposition compatibility.`] : 
      undefined;

    return { isValid: true, error: null, warnings };
  };

  // Auto-determine batch properties from selected jobs
  const determineBatchProperties = (jobs: FlyerJob[]): AutoBatchProperties => {
    const firstJob = jobs[0];
    
    return {
      paperType: firstJob.paper_type,
      paperWeight: firstJob.paper_weight,
      laminationType: 'none' as const, // Default for flyers
      printerType: 'HP 12000', // Default printer
      sheetSize: '530x750mm', // Standard sheet size
      slaTargetDays: 3 // Default SLA for flyers from product config
    };
  };

  // Generate batch summary for user feedback
  const generateBatchSummary = (jobs: FlyerJob[], properties: AutoBatchProperties) => {
    const totalQuantity = jobs.reduce((sum, job) => sum + job.quantity, 0);
    const sizes = [...new Set(jobs.map(job => job.size))];
    const earliestDueDate = jobs.reduce((earliest, job) => {
      const jobDate = new Date(job.due_date);
      return jobDate < earliest ? jobDate : earliest;
    }, new Date(jobs[0].due_date));

    return {
      jobCount: jobs.length,
      totalQuantity,
      sizes: sizes.join(', '),
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
