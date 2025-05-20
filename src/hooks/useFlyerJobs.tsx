
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

      // Remove user_id filter to allow seeing all flyer jobs
      const { data, error: fetchError } = await supabase
        .from('flyer_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Explicitly cast and ensure type compatibility
      const typedJobs: FlyerJob[] = (data || []).map(job => ({
        id: job.id,
        name: job.name,
        job_number: job.job_number,
        size: job.size,
        paper_weight: job.paper_weight,
        paper_type: job.paper_type,
        quantity: job.quantity,
        due_date: job.due_date,
        batch_id: job.batch_id,
        status: job.status,
        pdf_url: job.pdf_url,
        file_name: job.file_name,
        user_id: job.user_id,
        created_at: job.created_at,
        updated_at: job.updated_at
      }));
      
      setJobs(typedJobs);
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
      setJobs(prevJobs => [newJob as FlyerJob, ...prevJobs]);
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
      slaTargetDays: number; // Added slaTargetDays property
    }
  ) => {
    try {
      const batch = await createBatchWithSelectedJobs(selectedJobs, batchProperties);
      
      // Update local state to reflect the batched jobs
      setJobs(prevJobs => 
        prevJobs.map(job => 
          selectedJobs.some(selectedJob => selectedJob.id === job.id)
            ? { ...job, status: 'batched' as const, batch_id: batch.id }
            : job
        )
      );
      
      return batch;
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
    createBatch: handleCreateBatch,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  };
}
