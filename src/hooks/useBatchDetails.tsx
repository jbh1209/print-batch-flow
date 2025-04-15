
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BatchDetailsType, Job } from "@/components/batches/types/BatchTypes";

interface UseBatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string;
}

export function useBatchDetails({ batchId, productType, backUrl }: UseBatchDetailsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batch, setBatch] = useState<BatchDetailsType | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (batchId && user) {
      fetchBatchDetails();
    } else if (!user) {
      console.log("No authenticated user for batch details");
      setIsLoading(false);
    }
  }, [batchId, user]);

  const fetchBatchDetails = async () => {
    if (!user || !batchId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching batch details for batch ID: ${batchId}`);
      
      // Fetch batch details
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
      
      // Transform the data to match BatchDetailsType, ensuring overview_pdf_url is included
      // We explicitly construct the object to ensure all required properties are present
      const batchData: BatchDetailsType = {
        id: data.id,
        name: data.name,
        lamination_type: data.lamination_type,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url,
        back_pdf_url: data.back_pdf_url,
        overview_pdf_url: data.overview_pdf_url || null, // Safely handle overview_pdf_url
        due_date: data.due_date,
        created_at: data.created_at,
        status: data.status,
      };
      
      setBatch(batchData);
      
      // Fetch related jobs based on product type
      let jobsData: Job[] = [];
      
      // Determine which table to query based on product type
      // Currently only business cards have a dedicated table
      if (productType === "Business Cards") {
        console.log("Fetching related jobs for business card batch");
        
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) {
          console.error("Error fetching related jobs:", jobsError);
          throw jobsError;
        }
        
        console.log(`Found ${jobs?.length || 0} related jobs`);
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

  const handleDeleteBatch = async () => {
    if (!batchToDelete || !batch) return;
    
    setIsDeleting(true);
    try {
      // First reset all jobs in this batch back to queued status
      if (productType === "Business Cards") {
        const { error: jobsError } = await supabase
          .from("business_card_jobs")
          .update({ 
            status: "queued",  // Set status back to queued
            batch_id: null     // Remove batch_id reference
          })
          .eq("batch_id", batchToDelete);
        
        if (jobsError) throw jobsError;
      }
      
      // Then delete the batch
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchToDelete);
      
      if (deleteError) throw deleteError;
      
      toast({
        title: "Batch deleted",
        description: "The batch has been deleted and its jobs returned to queue",
      });
      
      // Navigate back
      navigate(backUrl);
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({
        title: "Error deleting batch",
        description: "Failed to delete batch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setBatchToDelete(null);
    }
  };

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch,
    fetchBatchDetails
  };
}
