
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { generateFlyerBatchNumber } from '../utils/flyerBatchUtils';
import { calculateSheetsRequired } from '../utils/sheetCalculator';
import { toast } from 'sonner';

/**
 * Type definition for batch properties
 */
export interface BatchProperties {
  paperType: string;
  paperWeight: string;
  laminationType: LaminationType;
  printerType: string;
  sheetSize: string;
  slaTargetDays: number;
}

/**
 * Service for handling batch operations
 */
export const FlyerBatchService = {
  /**
   * Creates a batch with selected jobs
   */
  async createBatchWithSelectedJobs(
    selectedJobs: FlyerJob[],
    batchProperties: BatchProperties,
    userId: string
  ) {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (selectedJobs.length === 0) {
      throw new Error('No jobs selected');
    }

    try {
      // Calculate sheets required based on job quantities and sizes
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      
      // Generate batch name with standardized format
      const batchNumber = await generateFlyerBatchNumber();
      
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
          created_by: userId,
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
      
      return batchData;
    } catch (err) {
      console.error('Error creating batch:', err);
      toast.error('Failed to create batch');
      throw err;
    }
  }
};
