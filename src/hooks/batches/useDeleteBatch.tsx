
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      if (productType === "Business Cards") {
        const { error: jobsError } = await supabase
          .from("business_card_jobs")
          .update({ 
            status: "queued",
            batch_id: null
          })
          .eq("batch_id", batchToDelete);
        
        if (jobsError) throw jobsError;
      } else if (productType === "Flyers") {
        const { error: jobsError } = await supabase
          .from("flyer_jobs")
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
      
      toast({
        title: "Batch deleted",
        description: "The batch has been deleted and its jobs returned to queue",
      });
      
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
