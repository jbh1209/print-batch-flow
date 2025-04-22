
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BaseJob, ProductConfig, JobStatus } from '@/config/productTypes';
import { useGenericBatch } from './useGenericBatch';
import { GenericJobFormValues } from '@/lib/schema/genericJobFormSchema';

export function useGenericJobs<T extends BaseJob>(config: ProductConfig) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { createBatchWithSelectedJobs, isCreatingBatch } = useGenericBatch<T>(config);
  
  // Fetch all jobs for this product type
  const fetchJobs = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from(config.tableName)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setJobs(data as T[] || []);
    } catch (err) {
      console.error(`Error fetching ${config.productType} jobs:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} jobs`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user, config.tableName]);

  // Delete a job
  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from(config.tableName)
        .delete()
        .eq('id', jobId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setJobs(jobs.filter(job => job.id !== jobId));
      toast.success("Job deleted successfully");
      return true;
    } catch (err) {
      console.error(`Error deleting ${config.productType} job:`, err);
      toast.error("Error deleting job");
      throw err;
    }
  };

  // Create a new job
  const createJob = async (
    jobData: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const newJob = {
        ...jobData,
        user_id: user.id,
        status: 'queued' as JobStatus
      };

      const { data, error } = await supabase
        .from(config.tableName)
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setJobs(prevJobs => [data as T, ...prevJobs]);
      return data as T;
    } catch (err) {
      console.error(`Error creating ${config.productType} job:`, err);
      throw err;
    }
  };

  // Update an existing job
  const updateJob = async (jobId: string, jobData: Partial<T>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase
        .from(config.tableName)
        .update(jobData)
        .eq('id', jobId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setJobs(prevJobs => 
        prevJobs.map(job => job.id === jobId ? { ...job, ...data } as T : job)
      );
      
      return data as T;
    } catch (err) {
      console.error(`Error updating ${config.productType} job:`, err);
      throw err;
    }
  };

  // Fetch a specific job by ID
  const getJobById = async (jobId: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase
        .from(config.tableName)
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      return data as T;
    } catch (err) {
      console.error(`Error getting ${config.productType} job:`, err);
      throw err;
    }
  };

  // Create a batch with selected jobs
  const handleCreateBatch = async (
    selectedJobs: T[],
    batchProperties: {
      paperType?: string;
      paperWeight?: string;
      laminationType?: string;
      printerType?: string;
      sheetSize?: string;
    }
  ) => {
    try {
      const batch = await createBatchWithSelectedJobs(selectedJobs, batchProperties);
      
      // Update local state to reflect the batched jobs
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

  // Fix jobs that are marked as batched but have no batch_id
  const fixBatchedJobsWithoutBatch = async () => {
    if (!user) {
      console.log("No authenticated user found for fix operation");
      return;
    }
    
    try {
      console.log("Finding orphaned batched jobs");
      
      // Find all jobs that are marked as batched but have no batch_id
      const { data: orphanedJobs, error: findError } = await supabase
        .from(config.tableName)
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Reset these jobs to queued status
        const { error: updateError } = await supabase
          .from(config.tableName)
          .update({ status: 'queued' })
          .in('id', orphanedJobs.map(job => job.id));
        
        if (updateError) throw updateError;
        
        console.log(`Reset ${orphanedJobs.length} jobs to queued status`);
        
        toast.success(`Reset ${orphanedJobs.length} orphaned jobs back to queued status`);
        
        // Refresh the job list
        await fetchJobs();
      }
    } catch (error) {
      console.error(`Error fixing batched ${config.productType} jobs:`, error);
      toast.error(`Failed to reset jobs with missing batch references.`);
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
    createBatch: handleCreateBatch,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch
  };
}
