
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
      
      // Create BatchDetailsType object, ensuring overview_pdf_url is properly set
      const batchData: BatchDetailsType = {
        id: data.id,
        name: data.name,
        lamination_type: data.lamination_type,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url,
        back_pdf_url: data.back_pdf_url,
        // Always use back_pdf_url as the overview_pdf_url since that column doesn't exist
        overview_pdf_url: data.back_pdf_url,
        due_date: data.due_date,
        created_at: data.created_at,
        status: data.status as BatchStatus, // Cast to the imported type
      };
      
      setBatch(batchData);
      
      let jobsData: Job[] = [];
      
      if (productType === "Business Cards") {
        console.log(`Fetching business card jobs for batch ID: ${batchId}`);
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url, file_name, lamination_type, due_date, uploaded_at, double_sided, job_number, updated_at, user_id")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) {
          console.error("Error fetching jobs:", jobsError);
          throw jobsError;
        }
        
        if (jobs && jobs.length > 0) {
          console.log(`Found ${jobs.length} jobs for batch ID: ${batchId}`);
          console.log("First job sample:", jobs[0]);
          
          // Cast to Job[] since we know all fields are present
          jobsData = jobs as unknown as Job[];
        } else {
          console.warn(`No jobs found for batch ID: ${batchId}`);
        }
      } else if (productType === "Flyers") {
        const { data: jobs, error: jobsError } = await supabase
          .from("flyer_jobs")
          .select("id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;

        // Add missing properties to flyer jobs to match Job interface
        if (jobs) {
          // Map each job to ensure it has all required properties
          jobsData = jobs.map(job => ({
            id: job.id,
            name: job.name,
            file_name: job.file_name || job.name || "",
            lamination_type: "none", // Default for flyers
            quantity: job.quantity,
            due_date: job.due_date || new Date().toISOString(),
            uploaded_at: job.created_at || new Date().toISOString(),
            status: job.status,
            pdf_url: job.pdf_url,
            job_number: job.job_number || job.name || "",
            updated_at: job.updated_at || new Date().toISOString(),
            user_id: job.user_id || "",
            double_sided: false // Default for flyers
          })) as Job[];
        }
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
