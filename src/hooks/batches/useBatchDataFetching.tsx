
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BaseBatch, BaseJob, ProductConfig } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableValidation";
import { 
  safeGet, 
  castToUUID, 
  safeString, 
  safeNumber,
  safeDbResult,
  safeExtract,
  asBatchData,
  safeDbMap,
  toSafeString
} from "@/utils/database/dbHelpers";

interface UseBatchDataFetchingProps {
  batchId: string;
  config: ProductConfig;
  userId: string | undefined;
}

export function useBatchDataFetching({ batchId, config, userId }: UseBatchDataFetchingProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [batch, setBatch] = useState<BaseBatch | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<BaseJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatchDetails = async () => {
    if (!userId || !batchId) {
      console.error("Missing user or batchId:", { user: !!userId, batchId });
      setIsLoading(false);
      setError("Missing required information to fetch batch details");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching batch details for batch ID: ${batchId} and product type: ${config.productType}`);
      
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", castToUUID(batchId))
        .eq("created_by", castToUUID(userId))
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
      
      console.log("Batch details received:", data);
      
      // Convert raw data to a safe format
      const batchData = asBatchData(data);
      
      // Safely check for a sleeve batch using safeString
      const batchName = toSafeString(batchData.name);
      const isSleeveBatch = batchName.startsWith('DXB-SL-');
      
      // Create batch data object with safe type conversions
      const typedBatchData: BaseBatch = {
        id: toSafeString(batchData.id),
        name: toSafeString(batchData.name),
        status: toSafeString(batchData.status) as any,
        sheets_required: safeNumber(batchData.sheets_required, 0),
        front_pdf_url: batchData.front_pdf_url ? toSafeString(batchData.front_pdf_url) : null,
        back_pdf_url: batchData.back_pdf_url ? toSafeString(batchData.back_pdf_url) : null,
        overview_pdf_url: null,
        due_date: toSafeString(batchData.due_date),
        created_at: toSafeString(batchData.created_at),
        created_by: toSafeString(batchData.created_by),
        lamination_type: toSafeString(batchData.lamination_type || 'none') as any,
        paper_type: batchData.paper_type ? toSafeString(batchData.paper_type) : (isSleeveBatch ? 'premium' : undefined),
        paper_weight: batchData.paper_weight ? toSafeString(batchData.paper_weight) : undefined,
        updated_at: toSafeString(batchData.updated_at)
      };
      
      setBatch(typedBatchData);
      
      const tableName = config.tableName;
      if (isExistingTable(tableName)) {
        console.log("Fetching related jobs from table:", tableName);
        
        // Use type assertion to bypass TypeScript's static checking
        const { data: jobsData, error: jobsError } = await supabase
          .from(tableName as any)
          .select("*")
          .eq("batch_id", castToUUID(batchId))
          .order("name");
      
        if (jobsError) {
          console.error("Error fetching related jobs:", jobsError);
          throw jobsError;
        }
        
        if (Array.isArray(jobsData) && jobsData.length > 0) {
          // Use our safe mapping function to process job data
          const processedJobs = safeDbMap(jobsData, job => {
            // Basic processing for all job types
            const baseJob: BaseJob = {
              id: toSafeString(job.id),
              name: toSafeString(job.name),
              status: toSafeString(job.status),
              quantity: safeNumber(job.quantity),
              due_date: toSafeString(job.due_date),
              pdf_url: job.pdf_url ? toSafeString(job.pdf_url) : null,
              file_name: job.file_name ? toSafeString(job.file_name) : undefined,
              job_number: toSafeString(job.job_number),
              batch_id: job.batch_id ? toSafeString(job.batch_id) : null
            };
            
            // Special handling for sleeve jobs
            if (isSleeveBatch && config.productType === "Sleeves") {
              return {
                ...baseJob,
                stock_type: job.stock_type ? toSafeString(job.stock_type) : "premium"
              };
            }
            
            return baseJob;
          });
          
          setRelatedJobs(processedJobs);
        } else {
          setRelatedJobs([]);
        }
      } else {
        console.log("Table does not exist yet:", tableName);
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

  useEffect(() => {
    fetchBatchDetails();
  }, [batchId, userId]);

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  };
}
