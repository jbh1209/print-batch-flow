
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LaminationType } from "@/components/business-cards/JobsTable";
import { BatchStatus } from "@/components/batches/types/BatchTypes";
import { handlePdfAction } from "@/utils/pdfActionUtils";

interface Batch {
  id: string;
  name: string;
  lamination_type: LaminationType;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: BatchStatus; // Now using our shared BatchStatus type
}

export const useBusinessCardBatches = (batchId: string | null) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBatches = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!user) {
        console.log("No authenticated user found for business card batches");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching business card batches for user:", user.id);
      
      let query = supabase
        .from("batches")
        .select("*")
        .eq("created_by", user.id)
        .filter('name', 'ilike', 'DXB-BC-%'); // Only fetch business card batches (prefix DXB-BC-)
        
      // If batchId is specified, filter to only show that batch
      if (batchId) {
        query = query.eq("id", batchId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) {
        console.error("Supabase error fetching batches:", error);
        throw error;
      }
      
      console.log("Business card batches received:", data?.length || 0, "records");
      
      setBatches(data || []);
      
      // If we're looking for a specific batch and didn't find it
      if (batchId && (!data || data.length === 0)) {
        console.log("Requested batch not found:", batchId);
        toast({
          title: "Batch not found",
          description: "The requested batch could not be found or you don't have permission to view it.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
      setError("Failed to load batch data");
      toast({
        title: "Error loading batches",
        description: "Failed to load batch data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPDF = (url: string | null) => {
    handlePdfAction(url, 'view');
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log("Deleting batch:", batchToDelete);
      
      // First reset all jobs in this batch back to queued
      const { error: jobsError } = await supabase
        .from("business_card_jobs")
        .update({ 
          status: "queued",  // Reset status to queued
          batch_id: null     // Clear batch_id reference
        })
        .eq("batch_id", batchToDelete);
      
      if (jobsError) {
        console.error("Error resetting jobs in batch:", jobsError);
        throw jobsError;
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
      
      toast({
        title: "Batch deleted",
        description: "The batch has been deleted and its jobs returned to queue",
      });
      
      // Refresh batch list
      fetchBatches();
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

  const handleViewBatchDetails = (batchId: string) => {
    navigate(`/batches/business-cards/batches?batchId=${batchId}`);
  };

  useEffect(() => {
    fetchBatches();
  }, [user, batchId]);

  return {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete
  };
};
