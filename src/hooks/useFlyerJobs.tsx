
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';

export function useFlyerJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

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

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('flyer_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update the jobs list after deletion
      setJobs(jobs.filter(job => job.id !== jobId));
      return true;
    } catch (err) {
      console.error('Error deleting flyer job:', err);
      throw err;
    }
  };

  // Add the createJob method
  const createJob = async (jobData: Omit<FlyerJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>) => {
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

      // Update the jobs list with the new job
      setJobs(prevJobs => [data, ...prevJobs]);

      return data;
    } catch (err) {
      console.error('Error creating flyer job:', err);
      throw err;
    }
  };

  // New function to fix jobs that are marked as batched but have no batch_id
  const fixBatchedJobsWithoutBatch = async () => {
    if (!user) {
      console.log("No authenticated user found for fix operation");
      return;
    }
    
    setIsFixingBatchedJobs(true);
    try {
      console.log("Finding orphaned batched jobs");
      
      // Find all jobs that are marked as batched but have no batch_id
      const { data: orphanedJobs, error: findError } = await supabase
        .from('flyer_jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) {
        console.error("Error finding orphaned jobs:", findError);
        throw findError;
      }
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Reset these jobs to queued status
        const { error: updateError } = await supabase
          .from('flyer_jobs')
          .update({ status: 'queued' })
          .in('id', orphanedJobs.map(job => job.id));
        
        if (updateError) {
          console.error("Error fixing orphaned jobs:", updateError);
          throw updateError;
        }
        
        console.log(`Reset ${orphanedJobs.length} jobs to queued status`);
        
        toast({
          title: "Jobs fixed",
          description: `Reset ${orphanedJobs.length} orphaned jobs back to queued status`,
        });
        
        // Refresh the job list
        await fetchJobs();
      }
    } catch (error) {
      console.error('Error fixing batched jobs:', error);
      toast({
        title: "Error fixing jobs",
        description: "Failed to reset jobs with missing batch references.",
        variant: "destructive",
      });
    } finally {
      setIsFixingBatchedJobs(false);
    }
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    deleteJob,
    createJob,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  };
}
