import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PostcardJob, PaperType, LaminationType } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';
import { usePostcardBatchCreation } from './usePostcardBatchCreation';

export function usePostcardJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<PostcardJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isCreatingBatch, createBatch } = usePostcardBatchCreation();

  const fetchJobs = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('postcard_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setJobs(data as PostcardJob[] || []);
    } catch (err) {
      console.error('Error fetching postcard jobs:', err);
      setError('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  const handleViewJob = (jobId: string) => {
    navigate(`/batches/postcards/jobs/${jobId}`);
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('postcard_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    }
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId) 
        : [...prev, jobId]
    );
  };

  const selectAllJobs = () => {
    const unbatchedJobs = jobs.filter(job => !job.batch_id && job.status === 'queued');
    setSelectedJobs(unbatchedJobs.map(job => job.id));
  };

  const clearSelection = () => {
    setSelectedJobs([]);
  };

  const handleCreateBatch = async (paperType: PaperType, laminationType: LaminationType) => {
    if (selectedJobs.length === 0) {
      toast.error('Please select at least one job to batch');
      return;
    }

    // Find the selected jobs
    const jobsToBatch = jobs.filter(job => selectedJobs.includes(job.id));
    
    // Make sure all jobs have compatible specifications
    const batchId = await createBatch(jobsToBatch, paperType, laminationType);
    
    if (batchId) {
      // Clear selection and refresh jobs
      clearSelection();
      fetchJobs();
      
      // Navigate to the batch detail page
      navigate(`/batches/postcards/batches?batchId=${batchId}`);
    }
  };

  return {
    jobs,
    isLoading,
    error,
    selectedJobs,
    isCreatingBatch,
    fetchJobs,
    handleViewJob,
    handleDeleteJob,
    toggleJobSelection,
    selectAllJobs,
    clearSelection,
    handleCreateBatch
  };
}
