
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BaseJob, ProductConfig, LaminationType } from '@/config/productTypes';
import { useGenericBatches } from './useGenericBatches';
import { useJobOperations } from './useJobOperations';
import { useBatchFixes } from './useBatchFixes';
import { isExistingTable } from '@/utils/database/tableValidation';
import { toast } from 'sonner'; // Import toast from sonner

export function useGenericJobs<T extends BaseJob>(config: ProductConfig) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { createBatchWithSelectedJobs, isCreatingBatch } = useGenericBatches<T>(config);
  const { deleteJob, createJob, updateJob, getJobById } = useJobOperations(config.tableName, user?.id);
  const { fixBatchedJobsWithoutBatch, isFixingBatchedJobs } = useBatchFixes(config.tableName, user?.id);

  // Fetch all jobs for this product type
  const fetchJobs = async () => {
    if (!user) {
      console.log('No authenticated user for jobs fetching');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (!config.tableName) {
        throw new Error(`Invalid table name for ${config.productType}`);
      }
      
      if (!isExistingTable(config.tableName)) {
        console.log(`Table ${config.tableName} doesn't exist yet, skipping fetch`);
        setJobs([] as T[]);
        setIsLoading(false);
        return;
      }

      console.log('Fetching all jobs from table:', config.tableName);
      
      // Use 'as any' to bypass TypeScript's type checking for the table name
      const { data, error: fetchError } = await supabase
        .from(config.tableName as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Jobs data received:', data?.length || 0, 'records');
      
      // Use explicit type casting to avoid excessive type instantiation
      setJobs((data || []) as unknown as T[]);
    } catch (err) {
      console.error(`Error fetching ${config.productType} jobs:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} jobs`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Handle job deletion with local state update
  const handleDeleteJob = async (jobId: string) => {
    try {
      // Only allow users to delete their own jobs
      const job = await getJobById(jobId, user?.id || '');
      if (job && job.user_id !== user?.id) {
        toast.error("You can only delete your own jobs");
        return false;
      }
      
      const success = await deleteJob(jobId);
      if (success) {
        setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      }
      return success;
    } catch (err) {
      console.error('Error deleting job:', err);
      return false;
    }
  };

  // Handle job creation with local state update
  const handleCreateJob = async (
    jobData: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    const newJob = await createJob<T>(jobData, user.id);
    setJobs(prevJobs => [newJob, ...prevJobs]);
    return newJob;
  };

  // Handle job update with local state update
  const handleUpdateJob = async (jobId: string, jobData: Partial<T>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Only allow users to update their own jobs
      const job = await getJobById(jobId, user.id);
      if (job && job.user_id !== user.id) {
        toast.error("You can only update your own jobs");
        throw new Error("Permission denied: You can only update your own jobs");
      }
      
      const updatedJob = await updateJob<T>(jobId, jobData, user.id);
      setJobs(prevJobs => 
        prevJobs.map(job => job.id === jobId ? { ...job, ...updatedJob } : job)
      );
      return updatedJob;
    } catch (err) {
      console.error('Error updating job:', err);
      throw err;
    }
  };

  // Handle batch creation with local state update
  const handleCreateBatch = async (
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
      // Check if user is trying to batch jobs they don't own
      const unauthorizedJobs = selectedJobs.filter(job => job.user_id !== user?.id);
      if (unauthorizedJobs.length > 0) {
        toast.error("You can only batch your own jobs");
        throw new Error("Permission denied: You can only batch your own jobs");
      }
      
      // Fixed: Ensure laminationType is properly converted to LaminationType type
      const typedLaminationType = batchProperties.laminationType || "none" as LaminationType;
      
      // Create a configuration object that combines the product config with the batch properties
      const batchConfig = {
        ...config,
        paperType: batchProperties.paperType,
        paperWeight: batchProperties.paperWeight,
        printerType: batchProperties.printerType,
        sheetSize: batchProperties.sheetSize,
        slaTargetDays: batchProperties.slaTargetDays !== undefined ? batchProperties.slaTargetDays : config.slaTargetDays,
        laminationType: typedLaminationType // Include laminationType in the config object
      };
      
      // Fixed: Pass only the selected jobs and combined config to the wrapper function
      // The wrapper function in useGenericBatches expects only 2 arguments
      const batch = await createBatchWithSelectedJobs(
        selectedJobs as BaseJob[], // Cast to BaseJob[] to match the expected type
        batchConfig
      );
      
      if (batch) {
        setJobs(prevJobs => 
          prevJobs.map(job => 
            selectedJobs.some(selectedJob => selectedJob.id === job.id)
              ? { ...job, status: 'batched', batch_id: batch.id } as T
              : job
          )
        );
      }
      
      return batch;
    } catch (err) {
      console.error('Error creating batch:', err);
      throw err;
    }
  };

  // Handle batch fixes with state refresh
  const handleFixBatchedJobs = async () => {
    if (!user) {
      console.log('No authenticated user for fixing batched jobs');
      return 0;
    }
    
    const fixedCount = await fixBatchedJobsWithoutBatch();
    if (fixedCount) {
      await fetchJobs();
    }
    return fixedCount;
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    deleteJob: handleDeleteJob,
    createJob: handleCreateJob,
    updateJob: handleUpdateJob,
    getJobById,
    createBatch: handleCreateBatch,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch: handleFixBatchedJobs,
    isFixingBatchedJobs
  };
}
