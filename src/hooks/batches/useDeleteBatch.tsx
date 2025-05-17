
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExistingTableName } from "@/config/types/baseTypes";
import { isExistingTable } from "@/utils/database/tableValidation";

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
      // Determine which job table to use based on product type
      let jobsTable: ExistingTableName;
      if (productType === "Business Cards") {
        jobsTable = "business_card_jobs";
      } else if (productType === "Flyers") {
        jobsTable = "flyer_jobs";
      } else if (productType === "Postcards") {
        jobsTable = "postcard_jobs";
      } else if (productType === "Boxes") {
        jobsTable = "box_jobs";
      } else if (productType === "Sleeves") {
        jobsTable = "sleeve_jobs";
      } else if (productType === "Stickers") {
        jobsTable = "sticker_jobs";
      } else if (productType === "Posters") {
        jobsTable = "poster_jobs";
      } else if (productType === "Covers") {
        jobsTable = "cover_jobs";
      } else {
        jobsTable = "business_card_jobs"; // Default
      }
      
      // Only attempt to reset jobs if we have a valid table
      if (isExistingTable(jobsTable)) {
        // Reset all jobs in this batch back to queued
        const { error: jobsError } = await supabase
          .from(jobsTable)
          .update({
            status: "queued",
            batch_id: null
          })
          .eq("batch_id", batchToDelete);
        
        if (jobsError) {
          console.error("Error resetting jobs in batch:", jobsError);
          throw jobsError;
        }
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
      
      toast({
        title: "Batch deleted",
        description: "The batch has been deleted and all its jobs returned to the queue"
      });
      
      // Redirect after deletion
      navigate(backUrl);
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({
        title: "Error deleting batch",
        description: "Failed to delete batch. Please try again.",
        variant: "destructive",
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
