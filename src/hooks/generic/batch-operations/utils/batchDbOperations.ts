
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExistingTableName } from "@/config/productTypes";
import { BatchData, BatchCreationResult } from "../types/batchCreationTypes";

/**
 * Creates a batch record in the database
 */
export async function createBatchRecord(batchData: BatchData): Promise<{ id: string } | null> {
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .insert(batchData)
    .select()
    .single();
    
  if (batchError) {
    console.error("Error creating batch:", batchError);
    throw batchError;
  }
  
  if (!batch) {
    throw new Error("Failed to create batch, returned data is empty");
  }
  
  return batch;
}

/**
 * Updates jobs with batch ID
 */
export async function updateJobsWithBatchId(
  tableName: ExistingTableName,
  jobIds: string[],
  batchId: string
): Promise<{ data: any[], error: any }> {
  return await supabase
    .from(tableName)
    .update({
      status: "batched",
      batch_id: batchId
    })
    .in("id", jobIds)
    .select('id, batch_id');
}

/**
 * Verifies jobs were properly updated with batch ID
 */
export async function verifyBatchJobUpdates(
  tableName: ExistingTableName,
  batchId: string
): Promise<number> {
  const { data: verificationData, error: verificationError } = await supabase
    .from(tableName)
    .select('id, batch_id')
    .eq('batch_id', batchId);
    
  if (verificationError) {
    console.error("Error verifying batch job updates:", verificationError);
    throw new Error(`Failed to verify job updates: ${verificationError.message}`);
  }
  
  return verificationData?.length || 0;
}

/**
 * Attempts to delete a batch (for rollback)
 */
export async function deleteBatch(batchId: string): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("batches")
    .delete()
    .eq("id", batchId);
    
  if (deleteError) {
    console.error("Error rolling back batch creation:", deleteError);
    return false;
  }
  
  return true;
}

/**
 * Creates standardized result object based on batch operation outcome
 */
export function createBatchResult(
  success: boolean, 
  batchId: string | null = null, 
  jobsUpdated: number = 0,
  error?: string
): BatchCreationResult {
  return {
    success,
    batchId,
    jobsUpdated,
    error
  };
}
