
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PostcardJob } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';
import { uploadPostcardPDF } from '@/services/postcards/postcard-storage';
import { createPostcardJobRecord, deletePostcardJob } from '@/services/postcards/postcard-job-service';
import { extractPaperWeight } from '@/utils/paper-weight';
import { useJobValidation } from './useJobValidation';

export function usePostcardJobOperations() {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { validateUser } = useJobValidation();

  const handleDeleteJob = async (jobId: string) => {
    const validUser = validateUser();
    return await deletePostcardJob(jobId, validUser.id);
  };

  const prepareJobData = async (
    jobData: Omit<PostcardJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'> & { file?: File },
    userId: string
  ) => {
    let pdfUrl = jobData.pdf_url;
    let fileName = jobData.file_name;

    if (jobData.file) {
      fileName = jobData.file.name;
      pdfUrl = await uploadPostcardPDF(userId, jobData.file);
    }

    const paperWeight = jobData.paper_weight || extractPaperWeight(jobData.paper_type);

    return {
      name: jobData.name,
      job_number: jobData.job_number,
      size: jobData.size,
      paper_type: jobData.paper_type,
      paper_weight: paperWeight,
      lamination_type: jobData.lamination_type,
      double_sided: jobData.double_sided,
      quantity: jobData.quantity,
      due_date: jobData.due_date,
      pdf_url: pdfUrl,
      file_name: fileName,
      user_id: userId
    };
  };

  const createJob = async (jobData: Omit<PostcardJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'> & { file?: File }) => {
    const validUser = validateUser();
    
    setIsSubmitting(true);
    try {
      console.log("Creating postcard job with data:", jobData);
      
      const preparedData = await prepareJobData(jobData, validUser.id);
      console.log("Submitting postcard job data:", preparedData);
      
      return await createPostcardJobRecord(preparedData);
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
