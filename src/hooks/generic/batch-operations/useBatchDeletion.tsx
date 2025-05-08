
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExistingTableName } from "@/config/types/baseTypes";
import { isExistingTable } from "@/utils/database/tableValidation";

export function useBatchDeletion(tableName: ExistingTableName, onSuccessCallback?: () => void) {
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log(`Deleting batch ${batchToDelete} and updating jobs in ${tableName}`);
      
      // Only attempt to reset jobs if the table exists
      if (isExistingTable(tableName)) {
        // First reset all jobs in this batch back to queued
        const { error: jobsError } = await supabase
          .from(tableName)
          .update({ 
            status: "queued",  // Reset status to queued
            batch_id: null     // Clear batch_id reference
          })
          .eq("batch_id", batchToDelete);
        
        if (jobsError) {
          console.error(`Error resetting jobs in batch (${tableName}):`, jobsError);
          throw jobsError;
        }
      } else {
        console.warn(`Table ${tableName} does not exist, skipping job updates`);
      }
      
      // Then delete the batch
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchToDelete);
      
      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
        throw deleteError;
      }
      
      console.log("Batch deleted successfully");
      toast.success("Batch deleted and its jobs returned to queue");
      
      // Call the success callback if provided
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch. Please try again.");
    } finally {
      setIsDeleting(false);
      setBatchToDelete(null);
    }
  };

  return {
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch
  };
}
