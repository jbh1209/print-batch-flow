import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BaseBatch, ProductConfig, BaseJob, LaminationType } from "@/config/productTypes";
import { handlePdfAction } from "@/utils/pdfActionUtils";

export function useGenericBatches<T extends BaseJob = BaseJob>(config: ProductConfig, batchId: string | null = null) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BaseBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const navigate = useNavigate();

  const fetchBatches = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use the "batches" table and filter by created_by
      let query = supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id);
      
      // If we have a batch type, use product type name to filter batches
      // For example, filter for batches that start with DXB-SL- for Sleeves
      const productPrefix = config.productType === "Sleeves" ? "DXB-SL-" : 
                          config.productType === "Flyers" ? "DXB-FL-" : 
                          config.productType === "Business Cards" ? "DXB-BC-" : "";
      
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
  
  // Add the missing createBatchWithSelectedJobs method
  const createBatchWithSelectedJobs = async (
    selectedJobs: T[],
    batchProperties: {
      paperType?: string;
      paperWeight?: string;
      laminationType?: LaminationType;
      printerType?: string;
      sheetSize?: string;
    }
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (selectedJobs.length === 0) {
      throw new Error('No jobs selected');
    }

    try {
      setIsCreatingBatch(true);
      
      // Calculate sheets required based on job quantities
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      
      // Generate a batch number based on product type
      const productPrefix = config.productType === "Sleeves" ? "DXB-SL-" : 
                          config.productType === "Flyers" ? "DXB-FL-" : 
                          config.productType === "Business Cards" ? "DXB-BC-" : "DXB-";
                          
      const batchNumber = await generateBatchNumber(productPrefix);
      
      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          paper_type: batchProperties.paperType,
          paper_weight: batchProperties.paperWeight,
          lamination_type: batchProperties.laminationType || "none",
          due_date: new Date().toISOString(),
          printer_type: batchProperties.printerType || "HP 12000",
          sheet_size: batchProperties.sheetSize || "530x750mm",
          sheets_required: sheetsRequired,
          created_by: user.id,
          status: 'pending'
        })
        .select()
        .single();
        
      if (batchError) throw batchError;
      
      // Update all selected jobs to be part of this batch
      const jobIds = selectedJobs.map(job => job.id);
      const { error: updateError } = await supabase
        .from(config.tableName as any)
        .update({ 
          batch_id: batchData.id,
          status: 'batched' 
        })
        .in('id', jobIds);
      
      if (updateError) throw updateError;
      
      toast.success(`Batch ${batchNumber} created with ${selectedJobs.length} jobs`);
      return batchData;
      
    } catch (err) {
      console.error('Error creating batch:', err);
      toast.error('Failed to create batch');
      throw err;
    } finally {
      setIsCreatingBatch(false);
    }
  };
  
  // Helper function to calculate sheets required
  const calculateSheetsRequired = (jobs: T[]): number => {
    // Simple calculation of sheets based on quantity
    // This could be enhanced for different product types
    let totalSheets = 0;
    
    for (const job of jobs) {
      let sheetsPerJob = 0;
      
      // Apply different calculations based on job size if it exists
      if ('size' in job && typeof job.size === 'string') {
        switch (job.size) {
          case 'A5':
            sheetsPerJob = Math.ceil(job.quantity / 2);
            break;
          case 'A4':
            sheetsPerJob = job.quantity;
            break;
          case 'DL':
            sheetsPerJob = Math.ceil(job.quantity / 3);
            break;
          case 'A3':
            sheetsPerJob = job.quantity * 1.5;
            break;
          default:
            sheetsPerJob = job.quantity;
        }
      } else {
        sheetsPerJob = job.quantity;
      }
      
      totalSheets += sheetsPerJob;
    }
    
    // Add some extra sheets for setup and testing
    totalSheets = Math.ceil(totalSheets * 1.1); // 10% extra
    
    return totalSheets;
  };

  // Generate a batch number with provided prefix
  const generateBatchNumber = async (prefix: string): Promise<string> => {
    try {
      // Get the count of existing batches with this prefix
      const { data, error } = await supabase
        .from('batches')
        .select('name')
        .filter('name', 'ilike', `${prefix}%`);
      
      if (error) throw error;
      
      // Generate the batch number
      const batchCount = (data?.length || 0) + 1;
      const batchNumber = `${prefix}${batchCount.toString().padStart(5, '0')}`;
      
      return batchNumber;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `${prefix}${new Date().getTime()}`; // Fallback using timestamp
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
    isCreatingBatch, // Export the isCreatingBatch state
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete,
    createBatchWithSelectedJobs // Export the createBatchWithSelectedJobs method
  };
}
