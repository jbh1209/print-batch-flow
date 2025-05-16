
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BatchDetailsType, Job, LaminationType } from "@/components/batches/types/BatchTypes";
import { convertToJobType } from "@/utils/typeAdapters";

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
      
      // Remove the user filter to allow viewing any batch
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
        console.log("Fetching business card jobs with ALL fields needed for PDF generation");
        // Remove user filter from job queries as well
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("*") // Select all fields to ensure we get double_sided and other required fields
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        
        console.log(`Found ${jobs?.length || 0} business card jobs, with full field data`);
        
        // Map jobs to include all required fields for the Job type using our utility
        jobsData = (jobs || []).map(job => convertToJobType({
          ...job, 
          // Ensure uploaded_at is not undefined
          uploaded_at: job.uploaded_at || job.created_at || new Date().toISOString()
        }));
      } else if (productType === "Flyers") {
        // Remove user filter from job queries
        const { data: jobs, error: jobsError } = await supabase
          .from("flyer_jobs")
          .select("*")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        
        // Map jobs to include all required fields for the Job type using our utility
        jobsData = (jobs || []).map(job => convertToJobType({
          ...job,
          // Add required fields that might be missing
          uploaded_at: job.created_at || new Date().toISOString(),
          lamination_type: "none" as LaminationType
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
