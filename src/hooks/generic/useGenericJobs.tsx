
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BaseJob, ProductConfig, JobStatus, ExistingTableName } from '@/config/productTypes';
import { useGenericBatch } from './useGenericBatch';
import { GenericJobFormValues } from '@/lib/schema/genericJobFormSchema';

export function useGenericJobs<T extends BaseJob>(config: ProductConfig) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { createBatchWithSelectedJobs, isCreatingBatch } = useGenericBatch<T>(config);
  
  // Helper function to check if a table exists in our database
  const isExistingTable = (tableName: string): tableName is ExistingTableName => {
    const existingTables: ExistingTableName[] = [
      "flyer_jobs",
      "postcard_jobs", 
      "business_card_jobs",
      "poster_jobs",
      "batches", 
      "profiles", 
      "user_roles"
    ];
    
    return existingTables.includes(tableName as ExistingTableName);
  };

  // Fetch all jobs for this product type
  const fetchJobs = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Make sure we have a valid tableName
      if (!config.tableName) {
        throw new Error(`Invalid table name for ${config.productType}`);
      }
      
      const tableName = config.tableName;
      
      // Check if the table exists before querying
      if (!isExistingTable(tableName)) {
        console.log(`Table ${tableName} doesn't exist yet, skipping fetch`);
        setJobs([] as T[]);
        setIsLoading(false);
        return;
      }

      // Use type assertion for the table name to satisfy TypeScript
      const { data, error: fetchError } = await supabase
        .from(tableName as ExistingTableName)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Use type assertion here since we know the data structure matches T
      setJobs((data || []) as T[]);
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

  // Delete a job
  const deleteJob = async (jobId: string) => {
    try {
      const tableName = config.tableName;
      
      // Check if the table exists before querying
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot delete job`);
      }
      
      // Use type assertion for the table name to satisfy TypeScript
      const { error } = await supabase
        .from(tableName as ExistingTableName)
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
      const tableName = config.tableName;
      
      // Check if the table exists before querying
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot create job`);
      }
      
      const newJob = {
        ...jobData,
        user_id: user.id,
        status: 'queued' as JobStatus
      };

      // Use type assertion for the table name to satisfy TypeScript
      const { data, error } = await supabase
        .from(tableName as ExistingTableName)
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;

      // Update local state - use type assertion since we know this will match T
      setJobs(prevJobs => [(data as unknown) as T, ...prevJobs]);
      return (data as unknown) as T;
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
      const tableName = config.tableName;
      
      // Check if the table exists before querying
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot update job`);
      }
      
      // Use type assertion for the table name to satisfy TypeScript
      const { data, error } = await supabase
        .from(tableName as ExistingTableName)
        .update(jobData)
        .eq('id', jobId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state with type assertion
      setJobs(prevJobs => 
        prevJobs.map(job => job.id === jobId ? { ...job, ...(data as unknown as T) } : job)
      );
      
      return (data as unknown) as T;
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
      const tableName = config.tableName;
      
      // Check if the table exists before querying
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot get job`);
      }
      
      // Use type assertion for the table name to satisfy TypeScript
      const { data, error } = await supabase
        .from(tableName as ExistingTableName)
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      return (data as unknown) as T;
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
      
      const tableName = config.tableName;
      
      // Check if the table exists before querying
      if (!isExistingTable(tableName)) {
        console.log(`Table ${tableName} doesn't exist yet, skipping fix operation`);
        return;
      }
      
      // Find all jobs that are marked as batched but have no batch_id
      // Use type assertion for the table name to satisfy TypeScript
      const { data: orphanedJobs, error: findError } = await supabase
        .from(tableName as ExistingTableName)
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Reset these jobs to queued status
        // Use type assertion for the table name to satisfy TypeScript
        const { error: updateError } = await supabase
          .from(tableName as ExistingTableName)
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
