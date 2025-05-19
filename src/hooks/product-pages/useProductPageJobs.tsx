import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { 
  ProductPageJob, 
  ProductPageFormValues,
  PRODUCT_PAGES_TABLE
} from '@/components/product-pages/types/ProductPageTypes';
import { useProductPageBatchFix } from './useProductPageBatchFix';

export function useProductPageJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductPageJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  
  const fetchJobs = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from(PRODUCT_PAGES_TABLE)
        .select('*, product_page_templates!inner(*)')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setJobs(data?.map(item => ({
        ...item,
        custom_fields: item.custom_fields as Record<string, any>,
      })) || []);
    } catch (err) {
      console.error('Error fetching product page jobs:', err);
      setError('Failed to load product page jobs');
    } finally {
      setIsLoading(false);
    }
  };

  // Use effect to load jobs on mount and when user changes
  useEffect(() => {
    fetchJobs();
  }, [user]);

  // Create a new job
  const createJob = async (jobData: ProductPageFormValues, file?: File) => {
    if (!user) {
      toast.error('You must be logged in to create jobs');
      return null;
    }

    try {
      setIsSubmitting(true);
      
      // If file is provided, upload it first
      let pdf_url = null;
      let file_name = null;
      
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `product_pages/${user.id}/${fileName}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('product_files')
          .upload(filePath, file);
          
        if (uploadError) throw uploadError;
        
        // Get public URL for the file
        const { data: urlData } = supabase.storage
          .from('product_files')
          .getPublicUrl(filePath);
          
        pdf_url = urlData.publicUrl;
        file_name = file.name;
      }
      
      // Create the job record
      const newJob = {
        template_id: jobData.template_id,
        name: jobData.name,
        job_number: jobData.job_number,
        quantity: jobData.quantity,
        due_date: jobData.due_date.toISOString(),
        custom_fields: jobData.custom_fields || {},
        user_id: user.id,
        pdf_url,
        file_name
      };

      const { data, error } = await supabase
        .from(PRODUCT_PAGES_TABLE)
        .insert([newJob])
        .select('*')
        .single();
        
      if (error) throw error;
      
      toast.success('Product page job created successfully');
      
      // Ensure the job with proper custom_fields typing is added
      const typedJob = {
        ...data,
        custom_fields: data.custom_fields as Record<string, any>
      } as ProductPageJob;
      
      setJobs(prevJobs => [typedJob, ...prevJobs]);
      return data;
    } catch (err) {
      console.error('Error creating product page job:', err);
      toast.error('Failed to create product page job');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete job
  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from(PRODUCT_PAGES_TABLE)
        .delete()
        .eq('id', jobId);
        
      if (error) throw error;
      
      // Update local state to remove the deleted job
      setJobs(jobs.filter(job => job.id !== jobId));
      return true;
    } catch (err) {
      console.error('Error deleting job:', err);
      throw err;
    }
  };

  const createBatchWithSelectedJobs = async (
    selectedJobs: ProductPageJob[],
    batchProperties: {
      paperType: string;
      paperWeight: string;
      printerType: string;
      sheetSize: string;
      slaTargetDays: number;
    }
  ) => {
    if (selectedJobs.length === 0) {
      toast.error('No jobs selected for batching');
      return null;
    }

    try {
      setIsCreatingBatch(true);
      
      // Generate a batch name using the job numbers
      const jobNumbers = selectedJobs.map(job => job.job_number).join(', ');
      const batchName = `PPG-${new Date().toISOString().split('T')[0]}-${jobNumbers.substring(0, 30)}`;

      // Insert the batch record with all required fields
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchName,
          status: 'pending',
          created_by: user?.id,
          due_date: new Date().toISOString(),
          sheets_required: selectedJobs.length, // This is an estimation
          paper_type: batchProperties.paperType,
          paper_weight: batchProperties.paperWeight,
          printer_type: batchProperties.printerType,
          sheet_size: batchProperties.sheetSize,
          sla_target_days: batchProperties.slaTargetDays,
          lamination_type: 'none' // Add required field with default value
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Update all selected jobs to be part of this batch
      const jobIds = selectedJobs.map(job => job.id);
      
      const { error: updateError } = await supabase
        .from(PRODUCT_PAGES_TABLE)
        .update({ 
          batch_id: batch.id,
          status: 'batched'
        })
        .in('id', jobIds);

      if (updateError) throw updateError;

      // Return the created batch
      return batch;
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create batch');
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Initialize the batch fix hook with our fetchJobs method
  const { fixBatchedJobsWithoutBatch, isFixingBatchedJobs } = useProductPageBatchFix(fetchJobs);

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    deleteJob,
    createJob,
    isSubmitting,
    createBatch: createBatchWithSelectedJobs,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  };
}
