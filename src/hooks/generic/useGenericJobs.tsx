
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { BaseJob, ProductConfig } from '@/config/productTypes';

// Let's fix the parameter handling to be more flexible
export const useGenericJobs = <T extends BaseJob = BaseJob>(
  config: ProductConfig | { productConfig: ProductConfig },
  initialJobId?: string
) => {
  // Handle both ways of passing the config
  const productConfig = 'productConfig' in config ? config.productConfig : config;
  
  const [jobs, setJobs] = useState<BaseJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<BaseJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch jobs from the database
  const fetchJobs = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (!productConfig.tableName) {
        throw new Error('Table name is not defined in product config');
      }
      
      const { data, error } = await supabase
        .from(productConfig.tableName)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Type assertion to ensure the data matches BaseJob[]
      setJobs(data as BaseJob[] || []);
      
      // If initialJobId is provided, set the selected job
      if (initialJobId && data) {
        const job = data.find(j => j.id === initialJobId);
        if (job) {
          setSelectedJob(job as BaseJob);
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
      if (!productConfig.tableName) {
        throw new Error('Table name is not defined in product config');
      }
      
      const { error } = await supabase
        .from(productConfig.tableName)
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

  // Fix batched jobs without batch
  const fixBatchedJobsWithoutBatch = async (): Promise<number | void> => {
    if (!user) return;
    
    setIsFixingBatchedJobs(true);
    
    try {
      if (!productConfig.tableName) {
        throw new Error('Table name is not defined in product config');
      }
      
      // Find all jobs with status 'batched' but no batch_id
      const { data, error } = await supabase
        .from(productConfig.tableName)
        .select('*')
        .eq('status', 'batched')
        .is('batch_id', null);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Reset these jobs to 'queued' status
        const { error: updateError } = await supabase
          .from(productConfig.tableName)
          .update({ status: 'queued' })
          .in('id', data.map(job => job.id));
          
        if (updateError) throw updateError;
        
        toast({
          title: 'Jobs Fixed',
          description: `${data.length} batched jobs without batch ID were reset to queued status.`,
        });
        
        // Refresh the jobs list
        await fetchJobs();
        
        // Return the number of fixed jobs
        return data.length;
      } else {
        toast({
          title: 'No Issues Found',
          description: 'All batched jobs have valid batch IDs.',
        });
        return 0;
      }
    } catch (err: any) {
      console.error('Error fixing batched jobs:', err);
      toast({
        title: 'Error',
        description: 'Failed to fix batched jobs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsFixingBatchedJobs(false);
    }
  };

  // Create a batch with selected jobs
  const createBatch = async (selectedJobs: BaseJob[], batchProperties: any): Promise<any> => {
    setIsCreatingBatch(true);
    try {
      // Placeholder for batch creation logic
      // This would typically call an API or service function
      console.log('Creating batch with jobs:', selectedJobs);
      console.log('Batch properties:', batchProperties);

      // You would implement real batch creation logic here
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: 'Success',
        description: 'Batch created successfully',
      });
      
      // Refresh jobs after creating the batch
      await fetchJobs();
      
      return { success: true, batchId: Date.now().toString() };
    } catch (err: any) {
      console.error('Error creating batch:', err);
      toast({
        title: 'Error', 
        description: 'Failed to create batch. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Get a job by ID
  const getJobById = async (id: string): Promise<BaseJob | null> => {
    if (!user) return null;
    
    try {
      if (!productConfig.tableName) {
        throw new Error('Table name is not defined in product config');
      }
      
      const { data, error } = await supabase
        .from(productConfig.tableName)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data as BaseJob;
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
  }, [user]);

  return {
    jobs,
    selectedJob,
    setSelectedJob,
    isLoading,
    error,
    fetchJobs,
    deleteJob,
    getJobById,
    formatJobData,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs,
    createBatch,
    isCreatingBatch
  };
};
