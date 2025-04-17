
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';

export function useFlyerJobOperations() {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('flyer_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user?.id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error deleting flyer job:', err);
      throw err;
    }
  };

  // Add the createJob method
  const createJob = async (jobData: Omit<FlyerJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>) => {
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
        .from('flyer_jobs')
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Error creating flyer job:', err);
      throw err;
    }
  };

  // New method to create a batch with selected jobs
  const createBatchWithSelectedJobs = async (
    selectedJobs: FlyerJob[], 
    batchProperties: {
      paperType: string;
      paperWeight: string;
      laminationType: LaminationType;
      printerType: string;
      sheetSize: string;
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
      
      // Generate a batch number in the format DXB-FL-00001
      const batchNumber = await generateBatchNumber();
      
      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          paper_type: batchProperties.paperType,
          paper_weight: batchProperties.paperWeight,
          lamination_type: batchProperties.laminationType,
          due_date: new Date().toISOString(), // Default to current date
          printer_type: batchProperties.printerType,
          sheet_size: batchProperties.sheetSize,
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
        .from('flyer_jobs')
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
  const calculateSheetsRequired = (jobs: FlyerJob[]): number => {
    let totalSheets = 0;
    
    for (const job of jobs) {
      // Calculate sheets based on size and quantity
      let sheetsPerJob = 0;
      
      switch (job.size) {
        case 'A5':
          // Assuming 2 A5s per sheet
          sheetsPerJob = Math.ceil(job.quantity / 2);
          break;
        case 'A4':
          // Assuming 1 A4 per sheet
          sheetsPerJob = job.quantity;
          break;
        case 'DL':
          // Assuming 3 DLs per sheet
          sheetsPerJob = Math.ceil(job.quantity / 3);
          break;
        case 'A3':
          // Assuming 1 A3 per sheet (special case)
          sheetsPerJob = job.quantity * 1.5; // A3 might require more paper
          break;
        default:
          sheetsPerJob = job.quantity;
      }
      
      totalSheets += sheetsPerJob;
    }
    
    // Add some extra sheets for setup and testing
    totalSheets = Math.ceil(totalSheets * 1.1); // 10% extra
    
    return totalSheets;
  };

  // Generate a batch number in the format DXB-FL-00001
  const generateBatchNumber = async (): Promise<string> => {
    try {
      // Get the count of existing batches
      const { count, error } = await supabase
        .from('batches')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      // Generate the batch number
      const batchCount = (count || 0) + 1;
      const batchNumber = `DXB-FL-${batchCount.toString().padStart(5, '0')}`;
      
      return batchNumber;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `DXB-FL-${new Date().getTime()}`; // Fallback using timestamp
    }
  };

  return {
    deleteJob,
    createJob,
    createBatchWithSelectedJobs,
    isCreatingBatch
  };
}
