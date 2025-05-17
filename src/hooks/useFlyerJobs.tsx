
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { useAuth } from './useAuth';

export const useFlyerJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!user) {
        console.log("No authenticated user found");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching all flyer jobs");
      
      // Remove user_id filter to allow all users to see all jobs
      const { data, error } = await supabase
        .from('flyer_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Ensure all jobs have required fields, especially uploaded_at
      const processedJobs = (data || []).map(job => ({
        ...job,
        uploaded_at: job.uploaded_at || job.created_at || new Date().toISOString()
      }));
      
      setJobs(processedJobs as FlyerJob[]);
    } catch (err) {
      console.error('Error fetching flyer jobs:', err);
      setError('Failed to fetch flyer jobs.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const createJob = async (jobData: Omit<FlyerJob, 'created_at' | 'id' | 'updated_at' | 'status' | 'batch_id' | 'user_id'>) => {
    if (!user) throw new Error("User not authenticated");
    
    try {
      const newJob = {
        ...jobData,
        user_id: user.id,
        status: 'queued' as const,
        uploaded_at: jobData.uploaded_at || new Date().toISOString() // Ensure uploaded_at field exists
      };

      const { data, error } = await supabase
        .from('flyer_jobs')
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;
      
      // Add the new job to the state
      setJobs(prev => [data as FlyerJob, ...prev]);
      
      return data;
    } catch (err) {
      console.error('Error creating flyer job:', err);
      toast.error('Failed to create flyer job');
      throw err;
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const { error } = await supabase
        .from('flyer_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      // Remove the deleted job from state
      setJobs(prev => prev.filter(job => job.id !== jobId));
      
      toast.success('Job deleted successfully');
      return true;
    } catch (err) {
      console.error('Error deleting flyer job:', err);
      toast.error('Failed to delete job');
      return false;
    }
  };

  const updateJobBatchId = async (jobId: string, batchId: string | null) => {
    if (!user) throw new Error("User not authenticated");

    try {
      // Update the job's batch_id and status in the database
      const { error } = await supabase
        .from('flyer_jobs')
        .update({
          batch_id: batchId,
          status: batchId ? 'batched' : 'queued'
        })
        .eq('id', jobId);

      if (error) throw error;

      // Update the local state to reflect the change
      setJobs(prev => prev.map(job => {
        if (job.id === jobId) {
          return {
            ...job,
            batch_id: batchId,
            status: batchId ? 'batched' : 'queued'
          };
        }
        return job;
      }));

      return true;
    } catch (err) {
      console.error('Error updating job batch ID:', err);
      return false;
    }
  };

  const updateJobStatus = async (jobId: string, status: FlyerJob['status']) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const { error } = await supabase
        .from('flyer_jobs')
        .update({ status })
        .eq('id', jobId);

      if (error) throw error;

      // Update the local state
      setJobs(prev => prev.map(job => {
        if (job.id === jobId) {
          return { ...job, status };
        }
        return job;
      }));

      return true;
    } catch (err) {
      console.error('Error updating job status:', err);
      return false;
    }
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    createJob,
    deleteJob,
    updateJobBatchId,
    updateJobStatus
  };
};
