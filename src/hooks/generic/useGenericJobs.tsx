import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BaseJob, ProductConfig } from '@/config/productTypes';
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';
import { useToast } from '@/components/ui/use-toast';

interface UseGenericJobsProps {
  productConfig: ProductConfig;
  initialJobId?: string;
}

export const useGenericJobs = ({ productConfig, initialJobId }: UseGenericJobsProps) => {
  const [jobs, setJobs] = useState<BaseJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<BaseJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch jobs from the database
  const fetchJobs = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from(productConfig.tableName || '')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setJobs(data || []);
      
      // If initialJobId is provided, set the selected job
      if (initialJobId && data) {
        const job = data.find(j => j.id === initialJobId);
        if (job) {
          setSelectedJob(job);
        }
      }
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
      setError(err.message || 'Failed to fetch jobs');
      toast({
        title: 'Error',
        description: 'Failed to fetch jobs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a job
  const deleteJob = async (id: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from(productConfig.tableName || '')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update the jobs list
      setJobs(jobs.filter(job => job.id !== id));
      
      toast({
        title: 'Success',
        description: 'Job deleted successfully',
      });
      
      return true;
    } catch (err: any) {
      console.error('Error deleting job:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete job. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Get a job by ID
  const getJobById = async (id: string): Promise<BaseJob | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from(productConfig.tableName || '')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      console.error('Error fetching job:', err);
      return null;
    }
  };

  // Format job data for display
  const formatJobData = (job: BaseJob) => {
    return {
      ...job,
      formattedDueDate: formatDate(job.due_date),
      formattedCreatedAt: formatDate(job.created_at),
      relativeTime: formatRelativeTime(job.due_date)
    };
  };

  // Load jobs on component mount
  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user, productConfig.tableName]);

  return {
    jobs,
    selectedJob,
    setSelectedJob,
    isLoading,
    error,
    fetchJobs,
    deleteJob,
    getJobById,
    formatJobData
  };
};
