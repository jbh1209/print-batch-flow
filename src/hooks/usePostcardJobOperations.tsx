
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PostcardJob, LaminationType, PaperType } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';

export function usePostcardJobOperations() {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('postcard_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user?.id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error deleting postcard job:', err);
      throw err;
    }
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
        
        // First upload the file to storage
        const fileExt = jobData.file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `postcard-jobs/${user.id}/${fileName}`;
        
        const { error: uploadError, data: fileData } = await supabase.storage
          .from('postcards')
          .upload(filePath, jobData.file);
          
        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          throw uploadError;
        }
        
        // Get the public URL for the uploaded file
        const { data: urlData } = await supabase.storage
          .from('postcards')
          .getPublicUrl(filePath);
          
        pdf_url = urlData.publicUrl;
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
        user_id: user.id,
        status: 'queued' as const
      };
      
      console.log("Submitting postcard job data:", newJobData);

      const { data, error } = await supabase
        .from('postcard_jobs')
        .insert(newJobData)
        .select()
        .single();

      if (error) {
        console.error('Error inserting postcard job:', error);
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Error creating postcard job:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to extract weight from paper type
  const extractPaperWeight = (paperType: PaperType): string => {
    // Extract the weight portion (e.g., "350gsm" from "350gsm Matt")
    const match = paperType.match(/(\d+gsm)/);
    return match ? match[0] : "350gsm"; // Default to 350gsm if not found
  };

  const createBatchWithSelectedJobs = async (
    selectedJobs: PostcardJob[], 
    batchProperties: {
      paperType: string;
      laminationType: LaminationType;
    }
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (selectedJobs.length === 0) {
      throw new Error('No jobs selected');
    }

    try {
      setIsCreatingBatch(true);
      
      // Calculate sheets required based on job quantities and sizes
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      
      // Generate a batch number specifically for postcard batches
      const batchNumber = await generatePostcardBatchNumber();
      
      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          paper_type: batchProperties.paperType,
          lamination_type: batchProperties.laminationType,
          due_date: new Date().toISOString(),
          sheets_required: sheetsRequired,
          created_by: user.id,
          status: 'pending'
        })
        .select()
        .single();
        
      if (batchError) throw batchError;
      
      // Update all selected jobs to be part of this batch
      const jobIds = selectedJobs.map(job => job.id);
      const { error: updateError } = await supabase
        .from('postcard_jobs')
        .update({ 
          batch_id: batchData.id,
          status: 'batched' 
        })
        .in('id', jobIds);
      
      if (updateError) throw updateError;
      
      toast.success(`Batch ${batchNumber} created with ${selectedJobs.length} jobs`);
      return batchData;
      
    } catch (err) {
      console.error('Error creating batch:', err);
      toast.error('Failed to create batch');
      throw err;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Helper function to calculate sheets required
  const calculateSheetsRequired = (jobs: PostcardJob[]): number => {
    let totalSheets = jobs.reduce((acc, job) => acc + Math.ceil(job.quantity / 4), 0);
    return Math.ceil(totalSheets * 1.1); // Add 10% for setup and testing
  };

  // Generate a batch number specifically for postcard batches
  const generatePostcardBatchNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('name')
        .filter('name', 'ilike', 'DXB-PC-%');
      
      if (error) throw error;
      
      const batchCount = (data?.length || 0) + 1;
      return `DXB-PC-${batchCount.toString().padStart(5, '0')}`;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `DXB-PC-${new Date().getTime()}`; // Fallback using timestamp
    }
  };

  return {
    deleteJob,
    createJob,
    createBatchWithSelectedJobs,
    isCreatingBatch,
    isSubmitting
  };
}
