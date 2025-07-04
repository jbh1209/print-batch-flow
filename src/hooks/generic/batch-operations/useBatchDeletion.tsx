
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ValidTableName, isExistingTable } from "@/utils/database/tableValidation";

export function useBatchDeletion(tableName: string | undefined, onSuccess: () => void) {
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchToDelete || !tableName) return;
    
    setIsDeleting(true);
    try {
      console.log("Deleting batch:", batchToDelete);
      
      // Validate the table name before using it with Supabase
      if (!isExistingTable(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
      }
      
      // Reset jobs in the batch (update their status and batch_id)
      // Use a type assertion with 'any' to bypass TypeScript's type checking
      const { error: jobsError } = await supabase
        .from(tableName as any)
        .update({ 
          status: "queued",
          batch_id: null
        })
        .eq("batch_id", batchToDelete);
      
      if (jobsError) {
        console.error("Error resetting jobs in batch:", jobsError);
        throw jobsError;
      }
      
      // Then delete the batch from the batches table
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
      onSuccess();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch. Please try again.");
    } finally {
      setIsDeleting(false);
      setBatchToDelete(null);
    }
  };

  return { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch };
}
