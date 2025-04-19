
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PostcardJob, LaminationType } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';

export function usePostcardJobOperations() {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

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

  const createJob = async (jobData: Omit<PostcardJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const newJob = {
        ...jobData,
        user_id: user.id,
        status: 'queued' as const
      };

      const { data, error } = await supabase
        .from('postcard_jobs')
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Error creating postcard job:', err);
      throw err;
    }
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
    isCreatingBatch
  };
}
