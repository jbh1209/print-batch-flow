
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type TableName = keyof Database['public']['Tables'];

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
      console.log(`Starting deletion for batch ${batchId} (${productType})`);
      
      // Step 1: Get the table name for this product type
      const tableName = this.getTableNameForProductType(productType);
      if (!tableName) {
        throw new Error(`Unsupported product type: ${productType}`);
      }
      
      // Step 2: Reset all jobs in this batch back to queued status
      console.log(`Resetting jobs in ${tableName} for batch ${batchId}`);
      
      const { error: jobsError } = await supabase
        .from(tableName)
        .update({ 
          status: "queued",
          batch_id: null
        })
        .eq("batch_id", batchId);
      
      if (jobsError) {
        console.error(`Error resetting jobs in ${tableName}:`, jobsError);
        throw jobsError;
      }
      
      // Step 3: Delete the batch record
      console.log(`Deleting batch ${batchId} from batches table`);
      
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchId);
      
      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
        throw deleteError;
      }
      
      console.log("Batch deleted successfully");
      
      // Step 4: Show success message
      toast.success("Batch deleted successfully", {
        description: "The batch has been deleted and all jobs returned to queue."
      });
      
      // Step 5: Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      return { success: true };
    } catch (error) {
      console.error("Error deleting batch:", error);
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
  private static getTableNameForProductType(productType: string): TableName | null {
    const tableMap: Record<string, TableName> = {
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
