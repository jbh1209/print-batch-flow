
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BatchDetailsType, Job } from "@/components/batches/types/BatchTypes";

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
    if (!batchId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching batch details for batch ID: ${batchId}`);
      
      // Removed the user_id filter to allow any user to view any batch
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", batchId)
        .single();
      
      if (error) {
        console.error("Error fetching batch:", error);
        throw error;
      }
      
      if (!data) {
        console.log("Batch not found");
        toast({
          title: "Batch not found",
          description: "The requested batch could not be found.",
          variant: "destructive",
        });
        navigate(backUrl);
        return;
      }
      
      console.log("Batch details received:", data?.id);
      console.log("Full batch data:", data);
      
      const batchData: BatchDetailsType = {
        id: data.id,
        name: data.name,
        lamination_type: data.lamination_type,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url,
        back_pdf_url: data.back_pdf_url,
        overview_pdf_url: data.overview_pdf_url || data.back_pdf_url, // Use explicit overview_pdf_url or fall back to back_pdf_url
        due_date: data.due_date,
        created_at: data.created_at,
        status: data.status,
      };
      
      setBatch(batchData);
      
      let jobsData: Job[] = [];
      
      if (productType === "Business Cards") {
        console.log(`Fetching business card jobs for batch ID: ${batchId}`);
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) {
          console.error("Error fetching jobs:", jobsError);
          throw jobsError;
        }
        
        if (jobs && jobs.length > 0) {
          console.log(`Found ${jobs.length} jobs for batch ID: ${batchId}`);
          jobsData = jobs;
        } else {
          console.warn(`No jobs found for batch ID: ${batchId}`);
        }
      } else if (productType === "Flyers") {
        const { data: jobs, error: jobsError } = await supabase
          .from("flyer_jobs")
          .select("id, name, quantity, status, pdf_url")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        jobsData = jobs || [];
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
    if (batchId) {
      fetchBatchDetails();
    } else {
      console.log("No batch ID provided for batch details");
      setIsLoading(false);
    }
  }, [batchId]);

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  };
}
