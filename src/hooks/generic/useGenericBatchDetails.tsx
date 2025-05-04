
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ProductConfig, BaseBatch, BaseJob } from "@/config/productTypes";
import { toast } from "sonner";
import { ValidTableName, isExistingTable } from "@/utils/database/tableValidation";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";

interface UseGenericBatchDetailsProps {
  batchId: string | undefined;
  config: ProductConfig;
}

export function useGenericBatchDetails({ batchId, config }: UseGenericBatchDetailsProps) {
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BaseBatch | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<BaseJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use our dedicated deletion hook
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = 
    useBatchDeletion(config.tableName, () => navigate(config.routes.batchesPath));

  useEffect(() => {
    const fetchBatchDetails = async () => {
      if (!batchId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch batch details
        const { data: batchData, error: batchError } = await supabase
          .from("batches")
          .select("*")
          .eq("id", batchId)
          .single();
        
        if (batchError) throw batchError;
        
        if (!batchData) {
          setError("Batch not found");
          return;
        }
        
        // Convert the batchData to BaseBatch, adding the overview_pdf_url property
        const batchWithOverview: BaseBatch = {
          ...batchData,
          overview_pdf_url: null // Adding the missing property with null value
        };
        
        setBatch(batchWithOverview);
        
        // Fetch associated jobs if there's a valid table name
        if (isExistingTable(config.tableName)) {
          const { data: jobsData, error: jobsError } = await supabase
            .from(config.tableName as any)
            .select("*")
            .eq("batch_id", batchId);
          
          if (jobsError) throw jobsError;
          
          setRelatedJobs(jobsData as BaseJob[]);
        }
      } catch (err) {
        console.error("Error fetching batch details:", err);
        setError("Failed to load batch details");
        toast.error("Error loading batch details");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBatchDetails();
  }, [batchId, config.tableName]);

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch
  };
}
