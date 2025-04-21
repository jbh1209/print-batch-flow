
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface PostcardJobData {
  name: string;
  size: string;
  paper_type: string;
  paper_weight: string;
  lamination_type: string;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
}

export function usePostcardJobOperations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const getNextJobNumber = async () => {
    try {
      // Get the current count of postcard jobs
      const { count, error: countError } = await supabase
        .from('postcard_jobs')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      // Format the job number with leading zeros, starting from 1
      const nextNumber = (count !== null ? count + 1 : 1).toString().padStart(5, '0');
      return nextNumber;
    } catch (error) {
      console.error('Error getting next job number:', error);
      return (Math.floor(Math.random() * 90000) + 10000).toString();
    }
  };

  const createPostcardJob = useCallback(async (jobData: PostcardJobData) => {
    if (!user) {
      toast.error('You must be logged in to create a job');
      return false;
    }

    try {
      setIsSubmitting(true);
      
      // Get next job number
      const jobNumber = await getNextJobNumber();
      
      const { error } = await supabase.from('postcard_jobs').insert({
        name: jobData.name,
        job_number: jobNumber,
        size: jobData.size,
        paper_type: jobData.paper_type,
        paper_weight: jobData.paper_weight,
        lamination_type: jobData.lamination_type,
        quantity: jobData.quantity,
        due_date: jobData.due_date,
        pdf_url: jobData.pdf_url,
        file_name: jobData.file_name,
        user_id: user.id,
        status: 'queued'
      });

      if (error) throw error;

      toast.success('Postcard job created successfully');
      navigate('/batches/postcards/jobs');
      return true;
    } catch (error) {
      console.error('Error creating postcard job:', error);
      toast.error('Failed to create postcard job');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, navigate]);

  const updateUploadProgress = (progress: number) => {
    setUploadProgress(progress);
  };

  return {
    isSubmitting,
    uploadProgress,
    createPostcardJob,
    updateUploadProgress
  };
}
