import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BusinessCardJob } from '@/components/batches/types/BusinessCardTypes';
import { useToast } from "@/hooks/use-toast";

export function useBusinessCardJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<BusinessCardJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchJobs = async () => {
    if (!user) {
      console.log('No authenticated user for business card jobs fetching');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('business_card_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching business card jobs:', err);
      setError('Failed to load business card jobs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const deleteJob = async (jobId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', jobId);

      if (deleteError) throw deleteError;

      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
    }
  };

  const createJob = async (jobData: Omit<BusinessCardJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status'>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase
        .from('business_card_jobs')
        .insert({
          ...jobData,
          user_id: user.id,
          status: 'queued',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setJobs(prevJobs => [data, ...prevJobs]);
      return data;
    } catch (err) {
      console.error('Error creating job:', err);
      throw err;
    }
  };

  const updateJob = async (jobId: string, jobData: Partial<BusinessCardJob>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Fetch the existing job to check the user_id
      const { data: existingJob, error: fetchError } = await supabase
        .from('business_card_jobs')
        .select('user_id')
        .eq('id', jobId)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (!existingJob) {
        throw new Error('Job not found');
      }
      
      if (existingJob.user_id !== user.id) {
        toast({
          title: "You can only update your own jobs",
          description: "Permission denied",
          variant: "destructive",
        });
        throw new Error("Permission denied: You can only update your own jobs");
      }

      const { data: job, error } = await supabase
        .from('business_card_jobs')
        .update(jobData)
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      // Fix the specific error by adding user_id to the interface or ensuring it exists
      const jobToUpdate = {
        ...job,
        user_id: job.user_id || user.id // Add this to ensure user_id exists
      };

      setJobs(prevJobs =>
        prevJobs.map(j => j.id === jobId ? { ...j, ...jobToUpdate } : j)
      );
      return job;
    } catch (err) {
      console.error('Error updating job:', err);
      throw err;
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
  };
}
