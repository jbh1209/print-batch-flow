
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
  
  console.log("=== useGenericBatchDetails Debug ===");
  console.log("Hook called with batchId:", batchId);
  console.log("Config tableName:", config.tableName);
  console.log("Config productType:", config.productType);
  
  // Use our dedicated deletion hook
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = 
    useBatchDeletion(config.tableName, () => navigate(config.routes.batchesPath));

  useEffect(() => {
    const fetchBatchDetails = async () => {
      console.log("fetchBatchDetails called with batchId:", batchId);
      
      if (!batchId) {
        console.log("No batchId provided, skipping fetch");
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        console.log("Fetching batch from Supabase with ID:", batchId);
        
        // Fetch batch details - removed any user_id filter to allow viewing any batch
        const { data: batchData, error: batchError } = await supabase
          .from("batches")
          .select("*")
          .eq("id", batchId)
          .single();
        
        console.log("Batch query result:", { batchData, batchError });
        
        if (batchError) {
          console.error("Batch fetch error:", batchError);
          throw batchError;
        }
        
        if (!batchData) {
          console.warn("No batch data found for ID:", batchId);
          setError("Batch not found");
          return;
        }
        
        // Convert the batchData to BaseBatch, including the overview_pdf_url property
        const batchWithOverview: BaseBatch = {
          ...batchData,
          overview_pdf_url: batchData.overview_pdf_url || null
        };
        
        console.log("Setting batch data:", batchWithOverview);
        setBatch(batchWithOverview);
        
        // Fetch associated jobs if there's a valid table name
        console.log("Checking if table exists:", config.tableName, "isExisting:", isExistingTable(config.tableName));
        
        if (isExistingTable(config.tableName)) {
          console.log("Fetching jobs from table:", config.tableName, "for batch:", batchId);
          
          const { data: jobsData, error: jobsError } = await supabase
            .from(config.tableName as any)
            .select("*")
            .eq("batch_id", batchId);
          
          console.log("Jobs query result:", { jobsData, jobsError, count: jobsData?.length });
          
          if (jobsError) {
            console.error("Jobs fetch error:", jobsError);
            throw jobsError;
          }
          
          // We need to use a type assertion here to fix the TypeScript error
          // First cast to unknown, then to BaseJob[] to avoid TypeScript's excessive depth error
          setRelatedJobs(jobsData ? (jobsData as unknown as BaseJob[]) : []);
        } else {
          console.warn("Table does not exist:", config.tableName);
          setRelatedJobs([]);
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
