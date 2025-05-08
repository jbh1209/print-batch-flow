
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';
import { castToUUID, prepareUpdateParams, safeDbMap, toSafeString } from '@/utils/database/dbHelpers';

export function useFlyerJobOperations() {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('flyer_jobs')
        .delete()
        .eq('id', castToUUID(jobId))
        .eq('user_id', castToUUID(user?.id));

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
      // Fixed: Create a proper new job object with all required fields
      const newJob = prepareUpdateParams({
        ...jobData,
        user_id: user.id,
        status: 'queued',
        batch_id: null
      });

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
      
      // Extract numbers from existing batch names
      let nextNumber = 1;
      if (data && data.length > 0) {
        const batchNames = safeDbMap(data, batch => toSafeString(batch.name));
        const numbers = batchNames.map(name => {
          const match = name.match(/DXB-FL-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        
        // Find the highest number and increment
        nextNumber = Math.max(0, ...numbers) + 1;
      }
      
      // Format with 5 digits padding
      const batchNumber = `DXB-FL-${nextNumber.toString().padStart(5, '0')}`;
      
      return batchNumber;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `DXB-FL-${new Date().getTime().toString().substr(-5).padStart(5, '0')}`; // Fallback using timestamp
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
      
      // Create the batch with properly typed payload
      const batchData = prepareUpdateParams({
        name: batchNumber,
        paper_type: batchProperties.paperType,
        paper_weight: batchProperties.paperWeight,
        lamination_type: batchProperties.laminationType,
        due_date: new Date().toISOString(),
        printer_type: batchProperties.printerType,
        sheet_size: batchProperties.sheetSize,
        sheets_required: sheetsRequired,
        created_by: user.id,
        status: 'pending',
        sla_target_days: batchProperties.slaTargetDays
      });
      
      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert(batchData)
        .select()
        .single();
        
      if (batchError) throw batchError;
      
      if (!batchData) {
        throw new Error("Failed to create batch, returned data is empty");
      }
      
      // Update all selected jobs to be part of this batch
      const jobIds = safeDbMap(selectedJobs, job => toSafeString(job.id));
      
      // Create properly typed update data
      const updateData = prepareUpdateParams({ 
        batch_id: batchData.id,
        status: 'batched' 
      });
      
      const { error: updateError } = await supabase
        .from('flyer_jobs')
        .update(updateData)
        .in('id', jobIds as any);
      
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

  return {
    deleteJob,
    createJob,
    createBatchWithSelectedJobs,
    isCreatingBatch
  };
}
