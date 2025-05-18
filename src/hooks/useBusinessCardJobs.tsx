
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { BusinessCardJob } from '@/components/batches/types/BusinessCardTypes';
import { convertToJobType } from '@/utils/typeAdapters';
import { useToast } from '@/hooks/use-toast';

export const useBusinessCardJobs = () => {
  const [jobs, setJobs] = useState<BusinessCardJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!user) {
      console.log('User not logged in.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('business_card_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        setError(error.message);
      } else if (data) {
        // Convert from BaseJob to BusinessCardJob
        const convertedJobs = data as BusinessCardJob[];
        setJobs(convertedJobs);
      }
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
      setError('Failed to load jobs.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const addJob = async () => {
    if (!user) {
      console.error('User not logged in.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('business_card_jobs')
        .insert({
          user_id: user.id,
          status: 'queued',
          created_at: new Date().toISOString(),
          name: 'New Job',
          job_number: `BC-${Date.now().toString().slice(-6)}`,
          file_name: 'No file',
          pdf_url: '',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          quantity: 0,
          lamination_type: 'none',
          double_sided: false,
          uploaded_at: new Date().toISOString(),
          paper_type: '350gsm Matt'
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        setError(error.message);
      } else if (data) {
        const newJob = data as BusinessCardJob;
        setJobs(prevJobs => [newJob, ...prevJobs]);
      }
    } catch (err: any) {
      console.error('Error adding job:', err);
      setError('Failed to add job.');
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', jobId);

      if (error) {
        console.error('Supabase error:', error);
        setError(error.message);
        return false;
      } else {
        setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
        return true;
      }
    } catch (err: any) {
      console.error('Error deleting job:', err);
      setError('Failed to delete job.');
      return false;
    }
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    addJob,
    deleteJob,
  };
};
