
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BaseBatch, BaseJob, ProductConfig, BatchStatus } from "@/config/productTypes";
import { isExistingTable, asSupabaseTable } from "@/utils/database/tableUtils";

interface UseGenericBatchDetailsProps {
  batchId: string;
  config: ProductConfig;
}

export function useGenericBatchDetails({ batchId, config }: UseGenericBatchDetailsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batch, setBatch] = useState<BaseBatch | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<BaseJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBatchDetails = async () => {
    if (!user || !batchId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching batch details for batch ID: ${batchId}`);
      
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", batchId)
        .eq("created_by", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching batch:", error);
        throw error;
      }
      
      if (!data) {
        console.log("Batch not found");
        toast({
          title: "Batch not found",
          description: "The requested batch could not be found or you don't have permission to view it.",
          variant: "destructive",
        });
        navigate(config.routes.batchesPath);
        return;
      }
      
      console.log("Batch details received:", data?.id);
      
      // Ensure all properties are defined correctly for the BaseBatch interface
      const batchData: BaseBatch = {
        id: data.id,
        name: data.name,
        status: data.status as BatchStatus,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url || null,
        back_pdf_url: data.back_pdf_url || null,
        overview_pdf_url: null, // Add virtual property
        due_date: data.due_date,
        created_at: data.created_at,
        created_by: data.created_by,
        lamination_type: data.lamination_type || "none",
        paper_type: data.paper_type,
        paper_weight: data.paper_weight,
        updated_at: data.updated_at
      };
      
      setBatch(batchData);
      
      // Fetch related jobs from the product-specific table
      const tableName = config.tableName;
      if (isExistingTable(tableName)) {
        // Get the properly typed table name for Supabase
        const supabaseTable = asSupabaseTable(tableName);
        
        // Use the typed table name in the query
        const { data: jobs, error: jobsError } = await supabase
          .from(supabaseTable)
          .select("id, name, quantity, status, pdf_url")
          .eq("batch_id", batchId)
          .order("name");
      
        if (jobsError) throw jobsError;
        
        // Explicitly cast jobs to the correct type
        setRelatedJobs(jobs ? jobs as unknown as BaseJob[] : []);
      } else {
        // For tables that don't exist yet, return empty jobs array
        setRelatedJobs([]);
      }
    } catch (error) {
      console.error("Error fetching batch details:", error);
      setError("Failed to load batch details");
      toast({
        title: "Error loading batch",
        description: "Failed to load batch details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      const tableName = config.tableName;
      
      if (isExistingTable(tableName)) {
        // Get the properly typed table name for Supabase
        const supabaseTable = asSupabaseTable(tableName);
        
        // First reset all jobs in this batch back to queued status
        const { error: jobsError } = await supabase
          .from(supabaseTable)
          .update({ 
            status: "queued",
            batch_id: null
          })
          .eq("batch_id", batchToDelete);
        
        if (jobsError) throw jobsError;
      }
      
      // Then delete the batch
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchToDelete);
      
      if (deleteError) throw deleteError;
      
      toast({
        title: "Batch deleted",
        description: "The batch has been deleted and its jobs returned to queue",
      });
      
      navigate(config.routes.batchesPath);
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

  useEffect(() => {
    if (batchId && user) {
      fetchBatchDetails();
    } else if (!user) {
      console.log("No authenticated user for batch details");
      setIsLoading(false);
    }
  }, [batchId, user]);

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch,
    fetchBatchDetails
  };
}
