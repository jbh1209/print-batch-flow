import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FlyerJob, LaminationType } from "@/components/batches/types/FlyerTypes";
import { useFlyerJobOperations } from "@/hooks/flyers/useFlyerJobOperations";

export const useFlyerJobs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use the operations hook to get batch creation functionality
  const { createBatchWithSelectedJobs, isCreatingBatch } = useFlyerJobOperations();

  const fetchJobs = useCallback(async () => {
    // Wait for auth to load before fetching
    if (authLoading) {
      console.log("Auth still loading, waiting...");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("Fetching flyer jobs for all users");

      // Remove user filtering to show all jobs
      const { data, error: fetchError } = await supabase
        .from('flyer_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log("Flyer jobs fetched:", data?.length || 0, "jobs");
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching flyer jobs:', err);
      setError('Failed to load flyer jobs');
      toast.error("Failed to load flyer jobs");
    } finally {
      setIsLoading(false);
    }
  }, [authLoading]);

  // Initial fetch when auth is ready
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  const createJob = async (jobData: Omit<FlyerJob, 'id' | 'user_id' | 'status' | 'batch_id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const newJob = {
        ...jobData,
        user_id: user.id,
        status: 'queued' as const
      };

      const { data, error } = await supabase
        .from('flyer_jobs')
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;

      setJobs(prevJobs => [data, ...prevJobs]);
      return data;
    } catch (err) {
      console.error('Error creating flyer job:', err);
      throw err;
    }
  };

  const updateJob = async (jobId: string, jobData: Partial<FlyerJob>) => {
    try {
      // Remove user_id filter to allow any user to update any job
      const { data, error } = await supabase
        .from('flyer_jobs')
        .update(jobData)
        .eq('id', jobId)
        .select()
        .single();

      if (error) throw error;

      setJobs(prevJobs => 
        prevJobs.map(job => job.id === jobId ? { ...job, ...data } : job)
      );
      return data;
    } catch (err) {
      console.error('Error updating flyer job:', err);
      throw err;
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      // Remove user_id filter to allow any user to delete any job
      const { error } = await supabase
        .from('flyer_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      toast.success("Flyer job deleted successfully");
    } catch (err) {
      console.error('Error deleting flyer job:', err);
      toast.error("Failed to delete flyer job");
      throw err;
    }
  };

  const getJobById = async (jobId: string) => {
    try {
      // Remove user_id filter to allow any user to get any job
      const { data, error } = await supabase
        .from('flyer_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching flyer job:', err);
      throw err;
    }
  };

  const fixBatchedJobsWithoutBatch = async () => {
    try {
      console.log("Fixing batched flyer jobs without valid batch references");
      
      // Remove user filtering for fix operation
      const { data: batchedJobs, error: fetchError } = await supabase
        .from('flyer_jobs')
        .select('id, batch_id')
        .eq('status', 'batched');

      if (fetchError) throw fetchError;

      if (!batchedJobs || batchedJobs.length === 0) {
        console.log("No batched flyer jobs found");
        return 0;
      }

      // Check which batches actually exist
      const batchIds = [...new Set(batchedJobs.map(job => job.batch_id).filter(Boolean))];
      const { data: existingBatches, error: batchError } = await supabase
        .from('batches')
        .select('id')
        .in('id', batchIds);

      if (batchError) throw batchError;

      const existingBatchIds = new Set(existingBatches?.map(batch => batch.id) || []);
      const jobsToFix = batchedJobs.filter(job => 
        !job.batch_id || !existingBatchIds.has(job.batch_id)
      );

      if (jobsToFix.length === 0) {
        console.log("No flyer jobs need fixing");
        return 0;
      }

      // Reset jobs to queued status
      const { error: updateError } = await supabase
        .from('flyer_jobs')
        .update({ 
          status: 'queued',
          batch_id: null 
        })
        .in('id', jobsToFix.map(job => job.id));

      if (updateError) throw updateError;

      console.log(`Fixed ${jobsToFix.length} flyer jobs`);
      await fetchJobs();
      toast.success(`Fixed ${jobsToFix.length} orphaned flyer jobs`);
      return jobsToFix.length;
    } catch (err) {
      console.error('Error fixing batched flyer jobs:', err);
      toast.error("Failed to fix orphaned jobs");
      throw err;
    }
  };

  // Enhanced batch creation with better user feedback
  const createBatch = async (
    selectedJobs: FlyerJob[], 
    batchProperties: {
      paperType: string;
      paperWeight: string;
      laminationType: LaminationType;
      printerType: string;
      sheetSize: string;
      slaTargetDays: number;
    }
  ) => {
    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batching");
      return null;
    }

    try {
      console.log(`Creating batch with ${selectedJobs.length} jobs:`, {
        jobs: selectedJobs.map(j => ({ name: j.name, specs: `${j.paper_type} ${j.paper_weight}` })),
        properties: batchProperties
      });

      const result = await createBatchWithSelectedJobs(selectedJobs, batchProperties);
      
      // Refresh jobs after batch creation
      await fetchJobs();
      
      // Enhanced success message with batch details
      const totalQuantity = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
      toast.success(
        `Batch created successfully with ${selectedJobs.length} jobs (${totalQuantity} total quantity)`,
        {
          description: `Paper: ${batchProperties.paperType} ${batchProperties.paperWeight}`
        }
      );
      
      return result;
    } catch (error) {
      console.error('Error creating batch:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to create batch: ${errorMessage}`);
      throw error;
    }
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    createJob,
    updateJob,
    deleteJob,
    getJobById,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs: false,
    createBatch,
    isCreatingBatch
  };
};
