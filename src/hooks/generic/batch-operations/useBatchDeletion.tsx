
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TableName } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableUtils";

export function useBatchDeletion(tableName: TableName | undefined, onSuccess: () => void) {
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchToDelete || !tableName) return;
    
    setIsDeleting(true);
    try {
      console.log("Deleting batch:", batchToDelete);
      
      if (isExistingTable(tableName)) {
        // Use type assertion to bypass TypeScript's type checking for the table name
        const { error: jobsError } = await supabase
          .from(tableName as any)
          .update({ 
            status: "queued",
            batch_id: null
          })
          .eq("batch_id", batchToDelete);
        
        if (jobsError) throw jobsError;
      }
      
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchToDelete);
      
      if (deleteError) throw deleteError;
      
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
