
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExistingTableName } from "@/config/types/baseTypes";
import { isExistingTable } from "@/utils/database/tableValidation";
import { useNavigate } from "react-router-dom";

// Type to ensure we only accept valid table names
type TableNameParam = ExistingTableName | null;

export function useBatchDeletion(tableName: TableNameParam, onSuccessCallback?: () => void) {
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log(`Deleting batch ${batchToDelete} and updating jobs in ${tableName}`);
      
      // Only attempt to reset jobs if the table exists and is not null
      if (tableName && isExistingTable(tableName)) {
        // First reset all jobs in this batch back to queued
        // We need to avoid the deep type instantiation issue by using a type assertion
        const { error: jobsError } = await supabase
          .from(tableName as any) // Use 'any' to bypass TypeScript's deep type checking
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
        console.warn(`Table ${tableName} does not exist or is null, skipping job updates`);
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
      
      // Extract product type from current path for consistent navigation
      const currentPath = window.location.pathname;
      const pathParts = currentPath.split('/');
      
      // Find the product type segment (should be at index 2 in /batches/[product]/...)
      if (pathParts.length >= 3) {
        const productType = pathParts[2]; // e.g., "flyers", "boxes", etc.
        
        // Always navigate to the base product path (/batches/[product])
        // This avoids the '/batches/[product]/batches' 404 error
        navigate(`/batches/${productType}`);
      } else {
        // Fallback to home if path structure is unexpected
        navigate('/');
      }
    } catch (error: any) {
      console.error("Error deleting batch:", error);
      toast.error(`Failed to delete batch: ${error.message || "Please try again."}`);
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
