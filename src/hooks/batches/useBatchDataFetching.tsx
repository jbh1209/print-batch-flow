
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BaseBatch, BaseJob, ProductConfig } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableValidation";
import { 
  castToUUID, 
  toSafeString, 
  safeNumber,
  processDbFields,
  safeDbMap
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
      
      // Process data safely
      const processedData = processDbFields(data);
      
      // Safely check for a sleeve batch using safeString
      const batchName = toSafeString(processedData.name);
      const isSleeveBatch = batchName.startsWith('DXB-SL-');
      
      // Create batch data object with safe type conversions
      const typedBatchData: BaseBatch = {
        id: toSafeString(processedData.id),
        name: toSafeString(processedData.name),
        status: toSafeString(processedData.status) as any,
        sheets_required: safeNumber(processedData.sheets_required, 0),
        front_pdf_url: processedData.front_pdf_url ? toSafeString(processedData.front_pdf_url) : null,
        back_pdf_url: processedData.back_pdf_url ? toSafeString(processedData.back_pdf_url) : null,
        overview_pdf_url: null,
        due_date: toSafeString(processedData.due_date),
        created_at: toSafeString(processedData.created_at),
        created_by: toSafeString(processedData.created_by),
        lamination_type: toSafeString(processedData.lamination_type || 'none') as any,
        paper_type: processedData.paper_type ? toSafeString(processedData.paper_type) : (isSleeveBatch ? 'premium' : undefined),
        paper_weight: processedData.paper_weight ? toSafeString(processedData.paper_weight) : undefined,
        updated_at: toSafeString(processedData.updated_at)
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
            const processedJob = processDbFields(job);
            
            // Basic processing for all job types
            const baseJob: BaseJob = {
              id: toSafeString(processedJob.id),
              name: toSafeString(processedJob.name),
              status: toSafeString(processedJob.status),
              quantity: safeNumber(processedJob.quantity),
              due_date: toSafeString(processedJob.due_date),
              pdf_url: processedJob.pdf_url ? toSafeString(processedJob.pdf_url) : null,
              file_name: processedJob.file_name ? toSafeString(processedJob.file_name) : undefined,
              job_number: toSafeString(processedJob.job_number),
              batch_id: processedJob.batch_id ? toSafeString(processedJob.batch_id) : null
            };
            
            // Special handling for sleeve jobs
            if (isSleeveBatch && config.productType === "Sleeves") {
              return {
                ...baseJob,
                stock_type: processedJob.stock_type ? toSafeString(processedJob.stock_type) : "premium"
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
