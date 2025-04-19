
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PostcardJob } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';
import { uploadPostcardPDF } from '@/services/postcards/postcard-storage';
import { createPostcardJobRecord, deletePostcardJob } from '@/services/postcards/postcard-job-service';
import { extractPaperWeight } from '@/utils/paper-weight';

export function usePostcardJobOperations() {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeleteJob = async (jobId: string) => {
    if (!user) throw new Error('User not authenticated');
    return await deletePostcardJob(jobId, user.id);
  };

  const createJob = async (jobData: Omit<PostcardJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'> & { file?: File }) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsSubmitting(true);
    try {
      console.log("Creating postcard job with data:", jobData);
      
      // Handle file upload if a file is provided
      let pdf_url = jobData.pdf_url;
      let file_name = jobData.file_name;
      
      if (jobData.file) {
        file_name = jobData.file.name;
        pdf_url = await uploadPostcardPDF(user.id, jobData.file);
      }
      
      // For postcards, get the paper_weight from paper_type or provide a default
      const paperWeight = jobData.paper_weight || extractPaperWeight(jobData.paper_type);
      
      const newJobData = {
        name: jobData.name,
        job_number: jobData.job_number,
        size: jobData.size,
        paper_type: jobData.paper_type,
        paper_weight: paperWeight,
        lamination_type: jobData.lamination_type,
        double_sided: jobData.double_sided,
        quantity: jobData.quantity,
        due_date: jobData.due_date,
        pdf_url: pdf_url,
        file_name: file_name,
        user_id: user.id
      };
      
      console.log("Submitting postcard job data:", newJobData);
      return await createPostcardJobRecord(newJobData);

    } catch (err) {
      console.error('Error creating postcard job:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    deleteJob: handleDeleteJob,
    createJob,
    isCreatingBatch,
    isSubmitting
  };
}

