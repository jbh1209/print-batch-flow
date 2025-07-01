
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Database } from "@/integrations/supabase/types";

// Define valid table names from the database
type TableName = keyof Database['public']['Tables'];

interface UseDeleteBatchProps {
  productType: string;
  backUrl: string;
}

export function useDeleteBatch({ productType, backUrl }: UseDeleteBatchProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log("Deleting batch:", batchToDelete, "Product type:", productType);
      
      // Step 1: Reset all jobs in this batch based on product type
      let tableName: TableName;
      
      switch (productType) {
        case "Business Cards":
          tableName = "business_card_jobs";
          break;
        case "Flyers":
          tableName = "flyer_jobs";
          break;
        case "Postcards":
          tableName = "postcard_jobs";
          break;
        case "Posters":
          tableName = "poster_jobs";
          break;
        case "Sleeves":
          tableName = "sleeve_jobs";
          break;
        case "Stickers":
          tableName = "sticker_jobs";
          break;
        case "Covers":
          tableName = "cover_jobs";
          break;
        case "Boxes":
          tableName = "box_jobs";
          break;
        default:
          throw new Error(`Unsupported product type: ${productType}`);
      }
      
      console.log(`Resetting jobs in ${tableName} for batch ${batchToDelete}`);
      
      // Use proper typing for the from() method
      const { error: jobsError } = await supabase
        .from(tableName)
        .update({ 
          status: "queued",
          batch_id: null
        })
        .eq("batch_id", batchToDelete);
      
      if (jobsError) {
        console.error(`Error resetting jobs in ${tableName}:`, jobsError);
        throw jobsError;
      }
      
      // Step 2: Delete the batch
      console.log(`Deleting batch ${batchToDelete} from batches table`);
      
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchToDelete);
      
      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
        throw deleteError;
      }
      
      console.log("Batch deleted successfully");
      
      // Use sonner toast for consistent experience
      sonnerToast.success("Batch deleted successfully", {
        description: "The batch has been deleted and all jobs returned to queue."
      });
      
      // Navigate back to the batches page with correct batchflow prefix
      const updatedBackUrl = backUrl.startsWith('/batchflow') ? backUrl : `/batchflow${backUrl}`;
      navigate(updatedBackUrl);
    } catch (error) {
      console.error("Error deleting batch:", error);
      sonnerToast.error("Failed to delete batch", {
        description: "An error occurred while deleting the batch. Please try again."
      });
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
