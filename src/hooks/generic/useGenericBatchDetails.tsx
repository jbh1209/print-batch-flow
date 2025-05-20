
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ProductConfig, BaseBatch, BaseJob } from "@/config/productTypes";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableValidation";
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
        console.log(`Fetching batch details for batch ID: ${batchId} and table: ${config.tableName}`);
        
        // Fetch batch details
        const { data: batchData, error: batchError } = await supabase
          .from("batches")
          .select("*")
          .eq("id", batchId)
          .single();
        
        if (batchError) {
          console.error("Error fetching batch:", batchError);
          throw batchError;
        }
        
        if (!batchData) {
          setError("Batch not found");
          return;
        }
        
        console.log("Batch data received:", batchData);
        
        // Convert the batchData to BaseBatch, ensuring all PDF URLs are properly mapped
        const batchWithURLs: BaseBatch = {
          ...batchData,
          // Ensure all PDF URL fields are available, even if they're null
          front_pdf_url: batchData.front_pdf_url || null,
          back_pdf_url: batchData.back_pdf_url || null,
          overview_pdf_url: batchData.overview_pdf_url || batchData.back_pdf_url || null
        };
        
        setBatch(batchWithURLs);
        
        // Fetch associated jobs if there's a valid table name
        if (config.tableName && isExistingTable(config.tableName)) {
          console.log(`Fetching related jobs from table: ${config.tableName} for batch: ${batchId}`);
          
          const { data: jobsData, error: jobsError } = await supabase
            .from(config.tableName as any)
            .select("*")
            .eq("batch_id", batchId);
          
          if (jobsError) {
            console.error("Error fetching related jobs:", jobsError);
            throw jobsError;
          }
          
          console.log(`Found ${jobsData?.length || 0} related jobs`);
          
          // Type assertion as BaseJob[] to fix TypeScript's excessive depth error
          setRelatedJobs(jobsData ? (jobsData as unknown as BaseJob[]) : []);
        } else {
          console.warn(`Invalid table name: ${config.tableName}`);
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
