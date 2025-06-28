
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BatchDetailsType, Job, BatchStatus, JobStatus } from "@/components/batches/types/BatchTypes";

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
      
      // Fetch batch details
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
      
      // Create BatchDetailsType object
      const batchData: BatchDetailsType = {
        id: data.id,
        name: data.name,
        lamination_type: data.lamination_type,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url,
        back_pdf_url: data.back_pdf_url,
        overview_pdf_url: data.overview_pdf_url || data.back_pdf_url,
        due_date: data.due_date,
        created_at: data.created_at,
        status: data.status as BatchStatus,
      };
      
      setBatch(batchData);
      
      // Fetch related jobs based on product type
      let jobsData: Job[] = [];
      
      // Get the appropriate table name and fields based on product type
      const getJobQuery = async (productType: string) => {
        switch (productType) {
          case "Business Cards":
            const { data: businessCardJobs, error: bcError } = await supabase
              .from("business_card_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, lamination_type, due_date, uploaded_at, double_sided, job_number, updated_at, user_id")
              .eq("batch_id", batchId)
              .order("name");
            
            if (bcError) throw bcError;
            return businessCardJobs || [];
            
          case "Flyers":
            const { data: flyerJobs, error: flyerError } = await supabase
              .from("flyer_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id")
              .eq("batch_id", batchId)
              .order("name");
            
            if (flyerError) throw flyerError;
            return flyerJobs || [];
            
          case "Postcards":
            const { data: postcardJobs, error: postcardError } = await supabase
              .from("postcard_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id, lamination_type")
              .eq("batch_id", batchId)
              .order("name");
            
            if (postcardError) throw postcardError;
            return postcardJobs || [];
            
          case "Boxes":
            const { data: boxJobs, error: boxError } = await supabase
              .from("box_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id, lamination_type")
              .eq("batch_id", batchId)
              .order("name");
            
            if (boxError) throw boxError;
            return boxJobs || [];
            
          case "Covers":
            const { data: coverJobs, error: coverError } = await supabase
              .from("cover_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id, lamination_type")
              .eq("batch_id", batchId)
              .order("name");
            
            if (coverError) throw coverError;
            return coverJobs || [];
            
          case "Sleeves":
            const { data: sleeveJobs, error: sleeveError } = await supabase
              .from("sleeve_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id")
              .eq("batch_id", batchId)
              .order("name");
            
            if (sleeveError) throw sleeveError;
            return sleeveJobs || [];
            
          case "Stickers":
            const { data: stickerJobs, error: stickerError } = await supabase
              .from("sticker_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id, lamination_type")
              .eq("batch_id", batchId)
              .order("name");
            
            if (stickerError) throw stickerError;
            return stickerJobs || [];
            
          case "Posters":
            const { data: posterJobs, error: posterError } = await supabase
              .from("poster_jobs")
              .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id, lamination_type")
              .eq("batch_id", batchId)
              .order("name");
            
            if (posterError) throw posterError;
            return posterJobs || [];
            
          default:
            return [];
        }
      };

      const jobs = await getJobQuery(productType);
      
      if (jobs && jobs.length > 0) {
        console.log(`Found ${jobs.length} jobs for batch ID: ${batchId}`);
        console.log("First job sample:", jobs[0]);
        
        // Map jobs to consistent Job interface
        jobsData = jobs.map(job => ({
          id: job.id,
          name: job.name,
          file_name: job.file_name || job.name || "",
          lamination_type: job.lamination_type || "none",
          quantity: job.quantity || 0,
          due_date: job.due_date || new Date().toISOString(),
          uploaded_at: job.uploaded_at || job.created_at || new Date().toISOString(),
          status: job.status as JobStatus,
          pdf_url: job.pdf_url || null,
          job_number: job.job_number || job.name || "",
          updated_at: job.updated_at || new Date().toISOString(),
          user_id: job.user_id || "",
          double_sided: job.double_sided !== undefined ? job.double_sided : false
        })) as Job[];
      } else {
        console.warn(`No jobs found for batch ID: ${batchId}`);
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
