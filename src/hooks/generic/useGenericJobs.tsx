
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BaseJob, ProductConfig, LaminationType } from '@/config/productTypes';
import { useGenericBatch } from './useGenericBatch';
import { useJobOperations } from './useJobOperations';
import { useBatchFixes } from './useBatchFixes';
import { isExistingTable, getSupabaseTable } from '@/utils/database/tableUtils';

export function useGenericJobs<T extends BaseJob>(config: ProductConfig) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { createBatchWithSelectedJobs, isCreatingBatch } = useGenericBatch<T>(config);
  const { deleteJob, createJob, updateJob, getJobById } = useJobOperations(config.tableName, user?.id);
  const { fixBatchedJobsWithoutBatch, isFixingBatchedJobs } = useBatchFixes(config.tableName, user?.id);

  // Fetch all jobs for this product type
  const fetchJobs = async () => {
    if (!user) {
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

      // Get the table name as a simple string
      const supabaseTable = getSupabaseTable(config.tableName);

      const { data, error: fetchError } = await supabase
        .from(supabaseTable)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setJobs((data || []) as unknown as T[]);
    } catch (err) {
      console.error(`Error fetching ${config.productType} jobs:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} jobs`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  // Handle job deletion with local state update
  const handleDeleteJob = async (jobId: string) => {
    const success = await deleteJob(jobId);
    if (success) {
      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
    }
    return success;
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
    const updatedJob = await updateJob<T>(jobId, jobData, user.id);
    setJobs(prevJobs => 
      prevJobs.map(job => job.id === jobId ? { ...job, ...updatedJob } : job)
    );
    return updatedJob;
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
    }
  ) => {
    try {
      // Fixed: Ensure laminationType is properly converted to LaminationType type
      const typedLaminationType = batchProperties.laminationType || "none" as LaminationType;
      
      const batch = await createBatchWithSelectedJobs(selectedJobs, {
        ...batchProperties,
        laminationType: typedLaminationType
      });
      
      setJobs(prevJobs => 
        prevJobs.map(job => 
          selectedJobs.some(selectedJob => selectedJob.id === job.id)
            ? { ...job, status: 'batched', batch_id: batch.id } as T
            : job
        )
      );
      
      return batch;
    } catch (err) {
      throw err;
    }
  };

  // Handle batch fixes with state refresh
  const handleFixBatchedJobs = async () => {
    const fixedCount = await fixBatchedJobsWithoutBatch();
    if (fixedCount) {
      await fetchJobs();
    }
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
