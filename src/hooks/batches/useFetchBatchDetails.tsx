
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BatchDetailsType, Job } from "@/components/batches/types/BatchTypes";
import { ensureValidBatchStatus } from "@/utils/typeAdapters";

// Define the raw batch data structure to match what's returned from Supabase
interface RawBatchData {
  id: string;
  name: string;
  lamination_type: string;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url?: string | null; // Mark as optional since it might not exist in some records
  due_date: string;
  created_at: string;
  status: string;
  [key: string]: any; // Allow for other fields that might exist
}

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
      
      // Cast the raw data to our RawBatchData interface
      const rawBatchData = data as RawBatchData;
      
      // Create the batch object with all properties, properly handling optional fields
      const batchData: BatchDetailsType = {
        id: rawBatchData.id,
        name: rawBatchData.name,
        lamination_type: rawBatchData.lamination_type,
        sheets_required: rawBatchData.sheets_required,
        front_pdf_url: rawBatchData.front_pdf_url,
        back_pdf_url: rawBatchData.back_pdf_url,
        overview_pdf_url: rawBatchData.overview_pdf_url || null,
        due_date: rawBatchData.due_date,
        created_at: rawBatchData.created_at,
        status: ensureValidBatchStatus(rawBatchData.status),
      };
      
      setBatch(batchData);
      
      let jobsData: Job[] = [];
      
      if (productType === "Business Cards") {
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url, job_number")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        
        // Map jobs to include job_number
        jobsData = (jobs || []).map(job => ({
          id: job.id,
          name: job.name,
          quantity: job.quantity,
          status: job.status,
          pdf_url: job.pdf_url,
          job_number: job.job_number || `JOB-${job.id.substring(0, 6)}` // Ensure job_number is always provided
        }));
      } else if (productType === "Flyers") {
        const { data: jobs, error: jobsError } = await supabase
          .from("flyer_jobs")
          .select("id, name, quantity, status, pdf_url, job_number")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        
        // Map jobs to include job_number
        jobsData = (jobs || []).map(job => ({
          id: job.id,
          name: job.name,
          quantity: job.quantity,
          status: job.status,
          pdf_url: job.pdf_url,
          job_number: job.job_number || `JOB-${job.id.substring(0, 6)}` // Ensure job_number is always provided
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
