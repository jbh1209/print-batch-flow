
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useJobSpecificationDisplay } from '@/hooks/useJobSpecificationDisplay';

interface BusinessCardJob {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  double_sided: boolean;
  uploaded_at: string;
  due_date: string;
  batch_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  batch_ready: boolean;
  batch_allocated_at?: string;
  batch_allocated_by?: string;
  pdf_url: string;
  job_number: string;
  status: string;
  // Dynamic specification properties will be added at runtime
  lamination_type?: string;
  paper_type?: string;
  paper_weight?: string;
  size?: string;
}

export const useBusinessCardJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<BusinessCardJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getJobSpecifications } = useJobSpecificationDisplay();

  const fetchJobs = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('business_card_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Enhance jobs with specifications
      const enhancedJobs = await Promise.all(
        (data || []).map(async (job) => {
          const specifications = await getJobSpecifications(job.id, 'business_card_jobs');
          
          return {
            ...job,
            // Add specifications as properties
            ...specifications
          } as BusinessCardJob;
        })
      );

      setJobs(enhancedJobs);
    } catch (err) {
      console.error('Error fetching business card jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  return {
    jobs,
    isLoading,
    error,
    refetch: fetchJobs
  };
};
