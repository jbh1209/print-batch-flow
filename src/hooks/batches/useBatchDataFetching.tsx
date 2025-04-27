
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BaseBatch, BaseJob, ProductConfig } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableValidation";

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
        .eq("id", batchId)
        .eq("created_by", userId)
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
      
      const isSleeveBatch = data.name && data.name.startsWith('DXB-SL-');
      
      const batchData: BaseBatch = {
        id: data.id,
        name: data.name,
        status: data.status,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url || null,
        back_pdf_url: data.back_pdf_url || null,
        overview_pdf_url: null,
        due_date: data.due_date,
        created_at: data.created_at,
        created_by: data.created_by,
        lamination_type: data.lamination_type || "none",
        paper_type: data.paper_type || (isSleeveBatch ? "premium" : undefined),
        paper_weight: data.paper_weight,
        updated_at: data.updated_at
      };
      
      setBatch(batchData);
      
      const tableName = config.tableName;
      if (isExistingTable(tableName)) {
        console.log("Fetching related jobs from table:", tableName);
        
        const { data: jobsData, error: jobsError } = await supabase
          .from(tableName)
          .select("*")
          .eq("batch_id", batchId)
          .order("name");
      
        if (jobsError) {
          console.error("Error fetching related jobs:", jobsError);
          throw jobsError;
        }
        
        if (Array.isArray(jobsData)) {
          const processedJobs = jobsData.map(job => {
            if (isSleeveBatch && config.productType === "Sleeves") {
              return {
                ...job,
                stock_type: job.stock_type || "premium"
              };
            }
            return job;
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

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  };
}
