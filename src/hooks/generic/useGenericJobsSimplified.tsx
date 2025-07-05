/**
 * SIMPLIFIED GENERIC JOBS HOOK
 * 
 * Replaces the complex useGenericJobs with a simple unified system.
 * Uses the new unified batch creation system for all product types.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BaseJob, ProductConfig, LaminationType } from '@/config/productTypes';
import { useGenericBatches } from "./useGenericBatches";
import { useJobOperations } from './useJobOperations';
import { isExistingTable } from '@/utils/database/tableUtils';

export function useGenericJobs<T extends BaseJob>(config: ProductConfig) {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { createBatchWithSelectedJobs, isCreatingBatch } = useGenericBatches<T>(config);
  const { deleteJob, createJob, updateJob, getJobById } = useJobOperations(config.tableName, user?.id);

  // Fetch all jobs for this product type
  const fetchJobs = async () => {
    if (authLoading) {
      console.log("Auth still loading, waiting...");
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

      console.log('Fetching jobs from table:', config.tableName);
      
      const { data, error: fetchError } = await supabase
        .from(config.tableName as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Jobs data received:', data?.length || 0, 'records');
      setJobs((data || []) as unknown as T[]);
    } catch (err) {
      console.error(`Error fetching ${config.productType} jobs:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} jobs`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading]);

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
    const updatedJob = await updateJob<T>(jobId, jobData);
    setJobs(prevJobs => 
      prevJobs.map(job => job.id === jobId ? { ...job, ...updatedJob } : job)
    );
    return updatedJob;
  };

  // Simplified batch creation using the unified system
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
      console.log(`🔄 Creating batch with ${selectedJobs.length} jobs for ${config.productType}`);
      
      const batchConfig = {
        ...config,
        paperType: batchProperties.paperType,
        paperWeight: batchProperties.paperWeight,
        printerType: batchProperties.printerType,
        sheetSize: batchProperties.sheetSize,
        slaTargetDays: batchProperties.slaTargetDays !== undefined ? batchProperties.slaTargetDays : config.slaTargetDays,
        laminationType: batchProperties.laminationType || "none"
      };
      
      const batch = await createBatchWithSelectedJobs(
        selectedJobs as BaseJob[],
        batchConfig
      );
      
      if (batch) {
        console.log(`✅ Batch created successfully: ${batch.name}`);
        
        // Update local state to reflect batched jobs
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
      console.error('❌ Error creating batch:', err);
      throw err;
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
    // Legacy compatibility - add empty functions for missing properties
    fixBatchedJobsWithoutBatch: async () => {
      console.log('fixBatchedJobsWithoutBatch called - no longer needed with new system');
      return 0;
    },
    isFixingBatchedJobs: false
  };
}