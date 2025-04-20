
import { useState } from 'react';
import { PostcardJob } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractPaperWeight } from '@/utils/paper-weight';
import { useJobValidation } from './useJobValidation';

export function usePostcardJobOperations() {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { validateUser } = useJobValidation();

  const handleDeleteJob = async (jobId: string) => {
    const validUser = validateUser();
    try {
      const { error } = await supabase
        .from('postcard_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', validUser.id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
      throw err;
    }
  };

  const createJob = async (jobData: Omit<PostcardJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'> & { file?: File }) => {
    const validUser = validateUser();
    
    setIsSubmitting(true);
    try {
      console.log("Creating postcard job with data:", jobData);
      
      // Default values
      let pdfUrl = jobData.pdf_url;
      let fileName = jobData.file_name;

      // If a file was uploaded, process it
      if (jobData.file) {
        fileName = jobData.file.name;
        
        // Upload file using direct Supabase storage API
        const uniqueFileName = `${Date.now()}_${jobData.file.name.replace(/\s+/g, '_')}`;
        const filePath = `${validUser.id}/${uniqueFileName}`;
        
        console.log(`Uploading file to pdf_files/${filePath}`);
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('pdf_files')
          .upload(filePath, jobData.file, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          toast.error('Failed to upload PDF file');
          throw new Error(`Upload failed: ${uploadError.message}`);
        }
        
        // Get the public URL for the uploaded file
        const { data: urlData } = supabase.storage
          .from('pdf_files')
          .getPublicUrl(filePath);
          
        if (!urlData?.publicUrl) {
          throw new Error('Failed to generate public URL for uploaded file');
        }
        
        console.log('PDF uploaded successfully:', urlData.publicUrl);
        pdfUrl = urlData.publicUrl;
      } else if (!pdfUrl) {
        throw new Error('PDF file is required for new jobs');
      }

      // Extract paper weight from paper type if not provided
      const paperWeight = jobData.paper_weight || extractPaperWeight(jobData.paper_type);

      const jobRecord = {
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
        user_id: validUser.id,
        status: 'queued'
      };

      console.log("Submitting postcard job data:", jobRecord);
      
      const { data, error } = await supabase
        .from('postcard_jobs')
        .insert(jobRecord)
        .select()
        .single();

      if (error) {
        console.error('Error creating postcard job:', error);
        throw new Error(error.message);
      }

      toast.success('Postcard job created successfully');
      return data;
    } catch (err) {
      console.error('Error creating postcard job:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create job');
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
