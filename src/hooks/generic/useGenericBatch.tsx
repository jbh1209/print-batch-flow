
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BaseBatch, ProductConfig } from "@/config/productTypes";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { BatchStatus } from "@/config/productTypes";

export function useGenericBatches(config: ProductConfig, batchId: string | null = null) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BaseBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const fetchBatches = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the "batches" table and filter by created_by
      let query = supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id);
      
      // Get the correct product prefix for filtering
      const productPrefix = getProductPrefix(config.productType);
      
      if (productPrefix) {
        query = query.ilike('name', `${productPrefix}%`);
      }
      
      // If batchId is specified, filter to only show that batch
      if (batchId) {
        query = query.eq("id", batchId);
      }
      
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Convert to BaseBatch type with the required overview_pdf_url property
      const genericBatches: BaseBatch[] = (data || []).map(batch => ({
        ...batch,
        overview_pdf_url: null, // Add the missing property
        // Make sure lamination_type is set properly
        lamination_type: batch.lamination_type || "none"
      }));
      
      setBatches(genericBatches);
      
      // If we're looking for a specific batch and didn't find it
      if (batchId && (!data || data.length === 0)) {
        toast.error("Batch not found or you don't have permission to view it.");
      }
    } catch (err) {
      console.error(`Error fetching ${config.productType} batches:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} batches`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get the correct product prefix for filtering
  function getProductPrefix(productType: string): string {
    switch (productType) {
      case "Business Cards": return "DXB-BC";
      case "Flyers": return "DXB-FL";
      case "Postcards": return "DXB-PC";
      case "Posters": return "DXB-POST";
      case "Sleeves": return "DXB-SL";
      case "Boxes": return "DXB-PB";
      case "Covers": return "DXB-COV";
      case "Stickers": return "DXB-STK";  // Fixed to match the batch creation prefix
      default: return "";
    }
  }
  
  const handleViewPDF = (url: string | null) => {
    if (!url) {
      toast.error('No PDF available to view');
      return;
    }
    
    handlePdfAction(url, 'view');
  };

  const handleViewBatchDetails = (batchId: string) => {
    // Use URL pattern with path parameters instead of query parameters
    const path = `/batches/${config.productType.toLowerCase().replace(' ', '-')}/batches/${batchId}`;
    console.log("Navigating to batch details:", path);
    navigate(path);
  };
  
  const handleDeleteBatch = async () => {
    if (!batchToDelete || !config.tableName) return;
    
    setIsDeleting(true);
    try {
      console.log("Deleting batch:", batchToDelete);
      
      // First reset all jobs in this batch back to queued
      const { error: jobsError } = await supabase
        .from(config.tableName as any)
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
      
      toast.success("Batch deleted and its jobs returned to queue");
      
      // Refresh batch list
      fetchBatches();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch. Please try again.");
    } finally {
      setIsDeleting(false);
      setBatchToDelete(null);
    }
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
}
