
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
    if (!user || !batchId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching batch details for batch ID: ${batchId}`);
      
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", batchId)
        .eq("created_by", user.id)
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
      
      const batchData: BatchDetailsType = {
        id: data.id,
        name: data.name,
        lamination_type: data.lamination_type,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url,
        back_pdf_url: data.back_pdf_url,
        overview_pdf_url: data.back_pdf_url,
        due_date: data.due_date,
        created_at: data.created_at,
        status: data.status,
      };
      
      setBatch(batchData);
      
      let jobsData: Job[] = [];
      
      if (productType === "Business Cards") {
        // Expanded query to include ALL necessary fields for business card jobs
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url, job_number, file_name, double_sided, lamination_type, uploaded_at, paper_type, due_date")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        
        // Map complete job data
        jobsData = (jobs || []).map(job => ({
          id: job.id,
          name: job.name,
          quantity: job.quantity,
          status: job.status,
          pdf_url: job.pdf_url,
          job_number: job.job_number,
          file_name: job.file_name,
          double_sided: job.double_sided,
          lamination_type: job.lamination_type,
          due_date: job.due_date,
          uploaded_at: job.uploaded_at
        }));
      } else if (productType === "Flyers") {
        const { data: jobs, error: jobsError } = await supabase
          .from("flyer_jobs")
          .select("id, name, quantity, status, pdf_url, job_number, file_name, paper_type, paper_weight, size, due_date")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        
        // Map jobs for flyers
        jobsData = (jobs || []).map(job => ({
          id: job.id,
          name: job.name,
          quantity: job.quantity,
          status: job.status,
          pdf_url: job.pdf_url,
          job_number: job.job_number,
          file_name: job.file_name,
          paper_type: job.paper_type,
          paper_weight: job.paper_weight,
          size: job.size,
          due_date: job.due_date
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
