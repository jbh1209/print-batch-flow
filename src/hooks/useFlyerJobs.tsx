
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { useFlyerJobOperations } from './flyers/useFlyerJobOperations';
import { useFlyerBatchFix } from './flyers/useFlyerBatchFix';
import { toast } from 'sonner';

export function useFlyerJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { deleteJob, createJob, createBatchWithSelectedJobs, isCreatingBatch } = useFlyerJobOperations();
  
  const fetchJobs = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Use any type to avoid deep type instantiation
      const result: any = await supabase
        .from('flyer_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data, error: fetchError } = result;

      if (fetchError) throw fetchError;

      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching flyer jobs:', err);
      setError('Failed to load flyer jobs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  // Wrap the delete job operation to update local state
  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      // Update the jobs list after deletion
      setJobs(jobs.filter(job => job.id !== jobId));
      toast.success("Job deleted successfully");
      return true;
    } catch (err) {
      toast.error("Error deleting job");
      throw err;
    }
  };

  // Wrap the create job operation to update local state
  const handleCreateJob = async (jobData: Omit<FlyerJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>) => {
    try {
      const newJob = await createJob(jobData);
      // Update the jobs list with the new job
      setJobs(prevJobs => [newJob, ...prevJobs]);
      return newJob;
    } catch (err) {
      throw err;
    }
  };

  // Wrap the create batch operation
  const handleCreateBatch = async (
    selectedJobs: FlyerJob[],
    batchProperties: {
      paperType: string;
      paperWeight: string;
      laminationType: LaminationType;
      printerType: string;
      sheetSize: string;
    }
  ) => {
    try {
      const batch = await createBatchWithSelectedJobs(selectedJobs, batchProperties);
      
      // Update local state to reflect the batched jobs
      setJobs(prevJobs => 
        prevJobs.map(job => 
          selectedJobs.some(selectedJob => selectedJob.id === job.id)
            ? { ...job, status: 'batched', batch_id: batch.id }
            : job
        )
      );
      
      return batch;
    } catch (err) {
      throw err;
    }
  };

  // Use the batch fix hook
  const { fixBatchedJobsWithoutBatch, isFixingBatchedJobs } = useFlyerBatchFix();

  // Create a wrapper function that ensures the return type is Promise<number>
  const handleFixBatchedJobs = async (): Promise<number> => {
    const result = await fixBatchedJobsWithoutBatch();
    await fetchJobs(); // Refresh the jobs list after fixing
    return result;
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    deleteJob: handleDeleteJob,
    createJob: handleCreateJob,
    createBatch: handleCreateBatch,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch: handleFixBatchedJobs,
    isFixingBatchedJobs
  };
}
