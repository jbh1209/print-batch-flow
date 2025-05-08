
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ProductConfig, BaseBatch, BaseJob } from "@/config/productTypes";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableValidation";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";
import { castToUUID, processBatchData, processDbFields } from "@/utils/database/dbHelpers";

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
          .eq("id", castToUUID(batchId))
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
        
        // Process the batch data safely
        const processedBatchData = processBatchData(batchData);
        
        if (!processedBatchData) {
          setError("Failed to process batch data");
          return;
        }
        
        // Set the processed batch data
        setBatch(processedBatchData);
        
        // Fetch associated jobs if there's a valid table name
        if (config.tableName && isExistingTable(config.tableName)) {
          console.log(`Fetching related jobs from table: ${config.tableName} for batch: ${batchId}`);
          
          const { data: jobsData, error: jobsError } = await supabase
            .from(config.tableName as any)
            .select("*")
            .eq("batch_id", castToUUID(batchId));
          
          if (jobsError) {
            console.error("Error fetching related jobs:", jobsError);
            throw jobsError;
          }
          
          console.log(`Found ${jobsData?.length || 0} related jobs`);
          
          // Process each job safely
          const processedJobs: BaseJob[] = [];
          
          if (jobsData && Array.isArray(jobsData)) {
            for (const job of jobsData) {
              const processedJob = processDbFields(job);
              processedJobs.push(processedJob as BaseJob);
            }
          }
          
          setRelatedJobs(processedJobs);
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
