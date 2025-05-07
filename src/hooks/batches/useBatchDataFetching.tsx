
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BaseBatch, BaseJob, ProductConfig } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableValidation";
import { safeGet, castToUUID } from "@/utils/database/dbHelpers";

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
      
      // Safely check for a sleeve batch
      const nameValue = safeGet(data, 'name');
      const isSleeveBatch = typeof nameValue === 'string' && nameValue.startsWith('DXB-SL-');
      
      const batchData: BaseBatch = {
        id: safeGet(data, 'id') || '',
        name: safeGet(data, 'name') || '',
        status: safeGet(data, 'status') || 'pending',
        sheets_required: safeGet(data, 'sheets_required') || 0,
        front_pdf_url: safeGet(data, 'front_pdf_url') || null,
        back_pdf_url: safeGet(data, 'back_pdf_url') || null,
        overview_pdf_url: null,
        due_date: safeGet(data, 'due_date'),
        created_at: safeGet(data, 'created_at'),
        created_by: safeGet(data, 'created_by') || '',
        lamination_type: safeGet(data, 'lamination_type') || "none",
        paper_type: safeGet(data, 'paper_type') || (isSleeveBatch ? "premium" : undefined),
        paper_weight: safeGet(data, 'paper_weight'),
        updated_at: safeGet(data, 'updated_at')
      };
      
      setBatch(batchData);
      
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
        
        if (Array.isArray(jobsData)) {
          const processedJobs = jobsData.map(job => {
            // Special handling for sleeve jobs
            if (isSleeveBatch && config.productType === "Sleeves") {
              // Use type assertion for accessing stock_type and for spreading
              const typedJob = job as Record<string, any>;
              return {
                ...typedJob,
                stock_type: typedJob.stock_type || "premium"
              };
            }
            // Also need to use type assertion for any job object when spreading
            return job as Record<string, any>;
          });
          
          setRelatedJobs(processedJobs as BaseJob[]);
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
