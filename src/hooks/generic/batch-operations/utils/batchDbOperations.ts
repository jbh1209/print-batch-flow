
import { supabase } from '@/integrations/supabase/client';
import { BaseJob, BatchStatus } from '@/config/productTypes';
import { BatchCreationConfig } from '../types/batchCreationTypes';

/**
 * Updates job status and batch_id for selected jobs
 */
export const updateJobsWithBatchId = async <T extends BaseJob>(
  selectedJobs: T[],
  batchId: string,
  tableName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Extract only the IDs from selected jobs
    const jobIds = selectedJobs.map(job => job.id);
    
    // Update all selected jobs in a single operation
    // Use type assertion to handle the dynamic table name
    const { error } = await supabase
      .from(tableName as any)
      .update({
        status: 'batched' as BatchStatus,
        batch_id: batchId
      })
      .in('id', jobIds);

    if (error) {
      console.error(`Error updating jobs with batch ID:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error(`Error in updateJobsWithBatchId:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
};

/**
 * Creates a new batch record in the database
 */
export const createBatchRecord = async (
  config: BatchCreationConfig,
  sheetsRequired: number,
  batchName: string
) => {
  try {
    console.log('Creating batch record with name:', batchName);
    
    // Extract the properties for the batch record
    const batchData = {
      name: batchName,
      status: 'pending' as BatchStatus,
      lamination_type: config.laminationType || 'none',
      sheets_required: sheetsRequired,
      due_date: config.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      paper_type: config.paperType,
      paper_weight: config.paperWeight,
      printer_type: config.printerType || 'HP 12000',
      sheet_size: config.sheetSize || '530x750mm',
      sla_target_days: config.slaTargetDays || 3,
      created_by: config.userId
    };

    // Create the batch record - use the literal 'batches' table name
    const { data, error } = await supabase
      .from('batches')
      .insert(batchData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating batch record:', error);
      throw error;
    }

    // Use type assertion to convert response to expected type
    return data as {
      id: string;
      name: string;
      status: BatchStatus;
      lamination_type: string;
      sheets_required: number;
      due_date: string;
      paper_type: string | null;
      paper_weight: string | null;
      printer_type: string | null;
      sheet_size: string | null;
      created_at: string;
      created_by: string;
      [key: string]: any;
    };
  } catch (err) {
    console.error('Error in createBatchRecord:', err);
    throw err;
  }
};
