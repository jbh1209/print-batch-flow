
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { useFlyerJobOperations } from './flyers/useFlyerJobOperations';
import { useFlyerBatchFix } from './flyers/useFlyerBatchFix';

export function useFlyerJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { deleteJob, createJob } = useFlyerJobOperations();
  
  const fetchJobs = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('flyer_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

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
      return true;
    } catch (err) {
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

  // Initialize the batch fix hook with our fetchJobs method
  const { fixBatchedJobsWithoutBatch, isFixingBatchedJobs } = useFlyerBatchFix(fetchJobs);

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    deleteJob: handleDeleteJob,
    createJob: handleCreateJob,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  };
}
