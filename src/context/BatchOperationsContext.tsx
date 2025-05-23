
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getProductJobsTable } from "@/utils/batch/tableMapping";

// Define types for our context
type BatchOperationsContextType = {
  isDeletingBatch: boolean;
  batchBeingDeleted: string | null;
  deleteBatch: (batchId: string, productType: string, redirectUrl: string) => Promise<boolean>;
  setBatchBeingDeleted: (batchId: string | null) => void;
};

// Create the context with default values
const BatchOperationsContext = createContext<BatchOperationsContextType>({
  isDeletingBatch: false,
  batchBeingDeleted: null,
  deleteBatch: async () => false,
  setBatchBeingDeleted: () => {},
});

// Hook for consuming the context
export const useBatchOperations = () => useContext(BatchOperationsContext);

// Define the provider props
interface BatchOperationsProviderProps {
  children: ReactNode;
}

// Create a provider component
export const BatchOperationsProvider = ({ children }: BatchOperationsProviderProps) => {
  const navigate = useNavigate();
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [batchBeingDeleted, setBatchBeingDeleted] = useState<string | null>(null);

  // The main delete batch function that will be used across the app
  const deleteBatch = useCallback(
    async (batchId: string, productType: string, redirectUrl: string): Promise<boolean> => {
      if (!batchId) return false;
      
      console.log(`[BatchOperations] Starting deletion of batch ${batchId} (${productType})`);
      setIsDeletingBatch(true);
      
      try {
        // Get the appropriate table name for this product type
        const tableName = getProductJobsTable(productType);
        if (!tableName) {
          throw new Error(`Unknown product type: ${productType}`);
        }
        
        console.log(`[BatchOperations] Resetting jobs in ${tableName} for batch ${batchId}`);
        
        // Reset the jobs in the batch - use any to bypass TypeScript checking
        const { error: jobsError } = await (supabase as any)
          .from(tableName)
          .update({
            status: "queued",
            batch_id: null
          })
          .eq("batch_id", batchId);
        
        if (jobsError) {
          console.error(`[BatchOperations] Error resetting jobs:`, jobsError);
          throw jobsError;
        }
        
        // Delete the batch
        console.log(`[BatchOperations] Deleting batch ${batchId} from batches table`);
        const { error: deleteError } = await supabase
          .from("batches")
          .delete()
          .eq("id", batchId);
        
        if (deleteError) {
          console.error(`[BatchOperations] Error deleting batch:`, deleteError);
          throw deleteError;
        }
        
        console.log(`[BatchOperations] Batch ${batchId} deleted successfully`);
        
        // Show success notification
        toast.success("Batch deleted", {
          description: "The batch has been deleted and all jobs returned to queue."
        });
        
        // Navigate to the redirect URL if provided and delete was successful
        if (redirectUrl) {
          console.log(`[BatchOperations] Redirecting to ${redirectUrl}`);
          navigate(redirectUrl);
        }
        
        return true;
      } catch (error) {
        console.error(`[BatchOperations] Delete batch error:`, error);
        toast.error("Failed to delete batch", {
          description: "There was a problem deleting the batch. Please try again."
        });
        return false;
      } finally {
        setIsDeletingBatch(false);
        setBatchBeingDeleted(null);
      }
    },
    [navigate]
  );

  return (
    <BatchOperationsContext.Provider
      value={{
        isDeletingBatch,
        batchBeingDeleted,
        deleteBatch,
        setBatchBeingDeleted
      }}
    >
      {children}
    </BatchOperationsContext.Provider>
  );
};
