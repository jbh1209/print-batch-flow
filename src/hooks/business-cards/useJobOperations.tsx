
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Job, JobStatus, LaminationType } from '@/components/business-cards/JobsTable';

export function useJobOperations(userId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteJob = async (jobId: string) => {
    try {
      setIsLoading(true);
      
      if (!userId) {
        throw new Error('User ID is required to delete a job');
      }
      
      const { error } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      toast.success("Job deleted successfully");
      return true;
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error("Error deleting job");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getJobById = async (jobId: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('business_card_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      
      return data as Job;
    } catch (err) {
      console.error('Error getting job:', err);
      setError('Failed to retrieve job data');
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    deleteJob,
    getJobById,
    isLoading,
    error
  };
}
