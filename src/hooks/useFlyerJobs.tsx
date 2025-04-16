
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob, JobStatus } from '@/components/batches/types/FlyerTypes';

export function useFlyerJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('flyer_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

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

  const createJob = async (jobData: Omit<FlyerJob, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'status'>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { data, error } = await supabase
        .from('flyer_jobs')
        .insert({
          ...jobData,
          user_id: user.id,
          status: 'queued' as JobStatus
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh jobs list
      fetchJobs();

      return data;
    } catch (err) {
      console.error('Error creating flyer job:', err);
      throw err;
    }
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    createJob,
  };
}
