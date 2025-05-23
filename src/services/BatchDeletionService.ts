
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeletionResult {
  success: boolean;
  error?: string;
}

export class BatchDeletionService {
  /**
   * Delete a batch and reset all associated jobs to queued status
   */
  static async deleteBatch(
    batchId: string, 
    productType: string,
    onSuccess?: () => void
  ): Promise<DeletionResult> {
    try {
      console.log(`[BatchDeletion] Starting deletion for batch ${batchId} (${productType})`);
      
      // Step 1: Get the table name for this product type
      const tableName = this.getTableNameForProductType(productType);
      if (!tableName) {
        throw new Error(`Unsupported product type: ${productType}`);
      }
      
      console.log(`[BatchDeletion] Using table name: ${tableName}`);
      
      // Step 2: First, let's check if the batch exists
      const { data: batchCheck, error: batchCheckError } = await supabase
        .from("batches")
        .select("id, name")
        .eq("id", batchId)
        .single();
      
      if (batchCheckError) {
        console.error(`[BatchDeletion] Batch check failed:`, batchCheckError);
        throw new Error(`Batch not found: ${batchCheckError.message}`);
      }
      
      console.log(`[BatchDeletion] Batch found:`, batchCheck);
      
      // Step 3: Reset all jobs in this batch back to queued status
      console.log(`[BatchDeletion] Resetting jobs in ${tableName} for batch ${batchId}`);
      
      const { data: resetJobsData, error: jobsError } = await supabase
        .from(tableName as any)
        .update({ 
          status: "queued",
          batch_id: null
        })
        .eq("batch_id", batchId)
        .select("id");
      
      if (jobsError) {
        console.error(`[BatchDeletion] Error resetting jobs in ${tableName}:`, jobsError);
        throw new Error(`Failed to reset jobs: ${jobsError.message}`);
      }
      
      console.log(`[BatchDeletion] Reset ${resetJobsData?.length || 0} jobs to queued status`);
      
      // Step 4: Delete the batch record
      console.log(`[BatchDeletion] Deleting batch ${batchId} from batches table`);
      
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchId);
      
      if (deleteError) {
        console.error(`[BatchDeletion] Error deleting batch:`, deleteError);
        throw new Error(`Failed to delete batch: ${deleteError.message}`);
      }
      
      console.log(`[BatchDeletion] Batch ${batchId} deleted successfully`);
      
      // Step 5: Show success message
      toast.success("Batch deleted successfully", {
        description: `Batch "${batchCheck.name}" has been deleted and ${resetJobsData?.length || 0} jobs returned to queue.`
      });
      
      // Step 6: Call success callback if provided
      if (onSuccess) {
        console.log(`[BatchDeletion] Calling success callback`);
        onSuccess();
      }
      
      return { success: true };
    } catch (error) {
      console.error(`[BatchDeletion] Error deleting batch:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      toast.error("Failed to delete batch", {
        description: errorMessage
      });
      
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Get the correct table name for a product type
   */
  private static getTableNameForProductType(productType: string): string | null {
    const tableMap: Record<string, string> = {
      "Business Cards": "business_card_jobs",
      "Flyers": "flyer_jobs",
      "Postcards": "postcard_jobs",
      "Posters": "poster_jobs",
      "Sleeves": "sleeve_jobs",
      "Stickers": "sticker_jobs",
      "Covers": "cover_jobs",
      "Boxes": "box_jobs"
    };
    
    return tableMap[productType] || null;
  }
}
