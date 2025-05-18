
import { supabase } from './client';
import { toast } from "sonner";

/**
 * Delete a batch by ID
 * @param batchId The ID of the batch to delete
 * @returns Promise that resolves when batch is deleted
 */
export const deleteBatch = async (batchId: string): Promise<void> => {
  try {
    // First reset all jobs in this batch back to queued
    const { error: jobsError } = await supabase
      .from("business_card_jobs")
      .update({ 
        status: "queued",  // Reset status to queued
        batch_id: null     // Clear batch_id reference
      })
      .eq("batch_id", batchId);
    
    if (jobsError) {
      console.error("Error resetting jobs in batch:", jobsError);
      toast.error("Failed to reset jobs in batch", {
        description: jobsError.message
      });
      throw jobsError;
    }
    
    // Then delete the batch
    const { error: deleteError } = await supabase
      .from("batches")
      .delete()
      .eq("id", batchId);
    
    if (deleteError) {
      console.error("Error deleting batch:", deleteError);
      toast.error("Failed to delete batch", {
        description: deleteError.message
      });
      throw deleteError;
    }
    
    toast.success("Batch deleted successfully");
  } catch (error: any) {
    console.error("Error deleting batch:", error);
    throw new Error(`Failed to delete batch: ${error.message}`);
  }
};
