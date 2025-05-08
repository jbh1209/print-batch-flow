
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BatchDetailsType, Job } from "@/components/batches/types/BatchTypes";
import { 
  castToUUID, 
  processDbFields,
  toSafeString,
  safeNumber,
  safeDbMap,
  processDbFields as processData,
  ensureEnumValue
} from "@/utils/database/dbHelpers";
import { BatchStatus } from "@/config/types/baseTypes";

interface UseFetchBatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string;
}

export function useFetchBatchDetails({ 
  batchId, 
  productType, 
  backUrl 
}: UseFetchBatchDetailsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batch, setBatch] = useState<BatchDetailsType | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatchDetails = async () => {
    if (!user || !batchId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching batch details for batch ID: ${batchId}`);
      
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", castToUUID(batchId))
        .eq("created_by", castToUUID(user.id))
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
        navigate(backUrl);
        return;
      }
      
      console.log("Batch details received:", data?.id);
      
      // Process the data using our safe helper
      const processedData = processData(data);
      
      const batchData: BatchDetailsType = {
        id: toSafeString(processedData.id),
        name: toSafeString(processedData.name),
        lamination_type: ensureEnumValue(processedData.lamination_type, 'none'),
        sheets_required: safeNumber(processedData.sheets_required),
        front_pdf_url: processedData.front_pdf_url ? toSafeString(processedData.front_pdf_url) : null,
        back_pdf_url: processedData.back_pdf_url ? toSafeString(processedData.back_pdf_url) : null,
        overview_pdf_url: processedData.overview_pdf_url ? toSafeString(processedData.overview_pdf_url) : 
                       (processedData.back_pdf_url ? toSafeString(processedData.back_pdf_url) : null),
        due_date: toSafeString(processedData.due_date),
        created_at: toSafeString(processedData.created_at),
        status: ensureEnumValue(processedData.status, 'pending') as BatchStatus,
      };
      
      setBatch(batchData);
      
      let jobsData: Job[] = [];
      
      if (productType === "Business Cards") {
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url, job_number")
          .eq("batch_id", castToUUID(batchId))
          .order("name");
        
        if (jobsError) throw jobsError;
        
        // Map jobs using our safe mapping function
        jobsData = safeDbMap(jobs, job => ({
          id: toSafeString(job.id),
          name: toSafeString(job.name),
          quantity: safeNumber(job.quantity),
          status: toSafeString(job.status),
          pdf_url: job.pdf_url ? toSafeString(job.pdf_url) : null,
          job_number: toSafeString(job.job_number) || `JOB-${toSafeString(job.id).substring(0, 6)}`
        }));
      } else if (productType === "Flyers") {
        const { data: jobs, error: jobsError } = await supabase
          .from("flyer_jobs")
          .select("id, name, quantity, status, pdf_url, job_number")
          .eq("batch_id", castToUUID(batchId))
          .order("name");
        
        if (jobsError) throw jobsError;
        
        // Map jobs using our safe mapping function 
        jobsData = safeDbMap(jobs, job => ({
          id: toSafeString(job.id),
          name: toSafeString(job.name),
          quantity: safeNumber(job.quantity),
          status: toSafeString(job.status),
          pdf_url: job.pdf_url ? toSafeString(job.pdf_url) : null,
          job_number: toSafeString(job.job_number) || `JOB-${toSafeString(job.id).substring(0, 6)}`
        }));
      }
      
      setRelatedJobs(jobsData);
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
    fetchBatchDetails
  };
}
