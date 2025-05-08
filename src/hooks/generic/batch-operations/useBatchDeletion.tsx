
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseBatch, ExistingTableName } from "@/config/productTypes";
import { createUpdateData, castToUUID } from "@/utils/database/dbHelpers";

/**
 * Hook for handling batch deletion
 */
export function useBatchDeletion(tableName: ExistingTableName | null, onSuccessCallback?: () => void) {
  const [batchToDelete, setBatchToDelete] = useState<BaseBatch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    try {
      setIsDeleting(true);
      console.log(`Deleting batch ${batchToDelete.id}`);
      
      // Validate table name is provided
      if (!tableName) {
        toast.error("Missing table configuration");
        return;
      }
      
      // If we have a valid table name, update jobs to remove batch_id
      if (tableName) {
        console.log(`Unlinking jobs from table: ${tableName}`);
        
        // Prepare the update data with proper type safety
        const updateData = createUpdateData({
          status: "queued",
          batch_id: null
        });
        
        // Update all jobs linked to this batch to remove batch_id
        const { error: updateError } = await supabase
          .from(tableName)
          .update(updateData)
          .eq("batch_id", castToUUID(batchToDelete.id));
        
        if (updateError) {
          console.error("Error unlinking jobs from batch:", updateError);
          toast.error("Failed to unlink jobs from batch");
          return;
        }
      }
      
      // Delete the batch itself
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", castToUUID(batchToDelete.id));
      
      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
        toast.error("Failed to delete batch");
        return;
      }
      
      toast.success("Batch deleted successfully");
      
      // Clear the batch to delete
      setBatchToDelete(null);
      
      // Call the success callback if provided
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    } catch (error) {
      console.error("Error in batch deletion:", error);
      toast.error("An error occurred while deleting the batch");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    batchToDelete,
    setBatchToDelete,
    isDeleting,
    handleDeleteBatch
  };
}
