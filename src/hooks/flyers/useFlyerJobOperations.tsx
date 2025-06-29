import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';
import { addBusinessDays } from 'date-fns';

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
  const createJob = async (jobData: any) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Create a proper new job object with all required fields
      const newJob: any = {
        ...jobData,
        user_id: user.id,
        status: 'queued',
        batch_id: null
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

  // Updated type definition to include slaTargetDays
  interface BatchProperties {
    paperType: string;
    paperWeight: string;
    laminationType: LaminationType;
    printerType: string;
    sheetSize: string;
    slaTargetDays: number;
  }

  // Generate a batch number specifically for flyer batches, starting with 00001
  const generateFlyerBatchNumber = async (): Promise<string> => {
    try {
      // Get the count of existing flyer batches only (with DXB-FL prefix)
      const { data, error } = await supabase
        .from('batches')
        .select('name')
        .ilike('name', 'DXB-FL-%');
      
      if (error) throw error;
      
      // Extract numbers from existing batch names and find the highest
      let nextNumber = 1;
      if (data && data.length > 0) {
        const numbers = data.map(batch => {
          const match = batch.name.match(/DXB-FL-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        
        // Find the highest number and increment
        const maxNumber = Math.max(0, ...numbers);
        nextNumber = maxNumber + 1;
      }
      
      // Format with 5 digits padding starting from 00001
      const batchNumber = `DXB-FL-${nextNumber.toString().padStart(5, '0')}`;
      
      console.log(`Generated flyer batch number: ${batchNumber} (next number: ${nextNumber})`);
      return batchNumber;
    } catch (err) {
      console.error('Error generating flyer batch number:', err);
      // Fallback using timestamp
      return `DXB-FL-${new Date().getTime().toString().substr(-5).padStart(5, '0')}`;
    }
  };

  // New method to create a batch with selected jobs
  const createBatchWithSelectedJobs = async (
    selectedJobs: FlyerJob[], 
    batchProperties: BatchProperties
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
      
      // Generate batch name with standardized format
      const batchNumber = await generateFlyerBatchNumber();
      
      // Calculate the actual batch due date: today + SLA target days
      const today = new Date();
      const batchDueDate = addBusinessDays(today, batchProperties.slaTargetDays);
      
      // Get earliest job due date for reference
      const earliestJobDueDate = selectedJobs.reduce((earliest, job) => {
        const jobDate = new Date(job.due_date);
        return jobDate < earliest ? jobDate : earliest;
      }, new Date(selectedJobs[0].due_date));
      
      console.log(`Flyer batch due date calculation:`, {
        today: today.toISOString(),
        slaTargetDays: batchProperties.slaTargetDays,
        calculatedBatchDueDate: batchDueDate.toISOString(),
        earliestJobDueDate: earliestJobDueDate.toISOString()
      });
      
      // Create the batch - use type assertion to handle expanded lamination types
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          paper_type: batchProperties.paperType,
          paper_weight: batchProperties.paperWeight,
          lamination_type: batchProperties.laminationType as any, // Type assertion to bypass type check
          due_date: batchDueDate.toISOString(), // Use calculated batch due date
          printer_type: batchProperties.printerType,
          sheet_size: batchProperties.sheetSize,
          sheets_required: sheetsRequired,
          created_by: user.id,
          status: 'pending',
          sla_target_days: batchProperties.slaTargetDays
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
      
      toast.success(`Batch ${batchNumber} created with ${selectedJobs.length} jobs, due ${batchDueDate.toLocaleDateString()}`);
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

  return {
    deleteJob,
    createJob,
    createBatchWithSelectedJobs,
    isCreatingBatch
  };
}
