
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BaseJob, ProductConfig, LaminationType } from '@/config/productTypes';
import { useGenericJobs } from './useGenericJobs';
import { ensureValidJobsArray } from '@/utils/validation/typeGuards';
import { toast } from 'sonner';

export interface StandardJobsHookOptions {
  validateData?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface StandardJobsHookResult<T extends BaseJob = BaseJob> {
  jobs: T[];
  isLoading: boolean;
  error: string | null;
  fetchJobs: () => Promise<void>;
  deleteJob: (jobId: string) => Promise<boolean>;
  createJob: (jobData: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>) => Promise<T>;
  updateJob: (jobId: string, jobData: Partial<T>) => Promise<T>;
  getJobById: (jobId: string) => Promise<T | null>;
  createBatch: (selectedJobs: T[], batchProperties: {
    paperType?: string;
    paperWeight?: string;
    laminationType?: LaminationType;
    printerType?: string;
    sheetSize?: string;
    slaTargetDays?: number;
  }) => Promise<any>;
  isCreatingBatch: boolean;
  fixBatchedJobsWithoutBatch: () => Promise<number>;
  isFixingBatchedJobs: boolean;
}

/**
 * Standardized hook for job operations with consistent return structure
 * and built-in type validation
 */
export function useStandardJobs<T extends BaseJob = BaseJob>(
  config: ProductConfig,
  options: StandardJobsHookOptions = {}
): StandardJobsHookResult<T> {
  const { user } = useAuth();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Default options
  const {
    validateData = true,
    autoRefresh = false,
    refreshInterval = 60000 // 1 minute
  } = options;
  
  // Use the base generic jobs hook
  const genericJobsHook = useGenericJobs<T>(config);
  
  const {
    jobs: rawJobs,
    isLoading,
    error: baseError,
    fetchJobs: baseFetchJobs,
    deleteJob: baseDeleteJob,
    createJob: baseCreateJob,
    updateJob: baseUpdateJob,
    getJobById: baseGetJobById,
    createBatch: baseCreateBatch,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch: baseFixBatchedJobs,
    isFixingBatchedJobs
  } = genericJobsHook;
  
  // Validate jobs data if required
  const jobs = validateData 
    ? ensureValidJobsArray(rawJobs) as T[]
    : rawJobs;
  
  // Combine errors
  const error = validationErrors.length > 0
    ? `${baseError || ''} ${validationErrors.join(', ')}`
    : baseError;
  
  // Auto refresh setup
  useEffect(() => {
    if (!autoRefresh) return;
    
    const intervalId = setInterval(() => {
      if (user) {
        console.log("Auto-refreshing jobs data...");
        baseFetchJobs().catch(err => {
          console.error("Error during auto-refresh:", err);
        });
      }
    }, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [user, autoRefresh, refreshInterval, baseFetchJobs]);
  
  // Wrap the fetch function to add validation
  const fetchJobs = async () => {
    setValidationErrors([]);
    try {
      await baseFetchJobs();
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setValidationErrors([`Fetch error: ${err instanceof Error ? err.message : String(err)}`]);
      toast.error("Error loading job data");
    }
  };
  
  // Wrap other functions to add validation and better error handling
  const deleteJob = async (jobId: string) => {
    try {
      return await baseDeleteJob(jobId);
    } catch (err) {
      console.error("Error deleting job:", err);
      toast.error(`Failed to delete job: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };
  
  const createJob = async (jobData: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>) => {
    try {
      const job = await baseCreateJob(jobData);
      return job;
    } catch (err) {
      console.error("Error creating job:", err);
      toast.error(`Failed to create job: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  };
  
  const updateJob = async (jobId: string, jobData: Partial<T>) => {
    try {
      const job = await baseUpdateJob(jobId, jobData);
      return job;
    } catch (err) {
      console.error("Error updating job:", err);
      toast.error(`Failed to update job: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  };
  
  const getJobById = async (jobId: string) => {
    try {
      const job = await baseGetJobById(jobId, user?.id || '');
      if (!job) return null;
      
      if (validateData && !ensureValidJobsArray([job]).length) {
        console.error("Invalid job data received:", job);
        toast.error("Retrieved job data is invalid");
        return null;
      }
      
      return job;
    } catch (err) {
      console.error("Error getting job by ID:", err);
      toast.error(`Failed to load job details: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };
  
  const createBatch = async (
    selectedJobs: T[],
    batchProperties: {
      paperType?: string;
      paperWeight?: string;
      laminationType?: LaminationType;
      printerType?: string;
      sheetSize?: string;
      slaTargetDays?: number;
    }
  ) => {
    try {
      if (validateData) {
        // Validate all selected jobs
        const validatedJobs = ensureValidJobsArray(selectedJobs) as T[];
        if (validatedJobs.length !== selectedJobs.length) {
          toast.error(`Some selected jobs contain invalid data and were excluded`);
        }
        return await baseCreateBatch(validatedJobs, batchProperties);
      }
      
      return await baseCreateBatch(selectedJobs, batchProperties);
    } catch (err) {
      console.error("Error creating batch:", err);
      toast.error(`Failed to create batch: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  };
  
  const fixBatchedJobsWithoutBatch = async () => {
    try {
      return await baseFixBatchedJobs();
    } catch (err) {
      console.error("Error fixing batched jobs:", err);
      toast.error(`Failed to fix orphaned batched jobs: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
  };
  
  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    deleteJob,
    createJob,
    updateJob,
    getJobById,
    createBatch,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  };
}
