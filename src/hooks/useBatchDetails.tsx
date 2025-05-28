
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BatchDetailsType, Job } from "@/components/batches/types/BatchTypes";
import { toast } from "sonner";
import { useBatchDeletion } from "@/hooks/useBatchDeletion";

interface UseBatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string;
}

export function useBatchDetails({ batchId, productType, backUrl }: UseBatchDetailsProps) {
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchDetailsType | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("=== Business Card useBatchDetails Debug ===");
  console.log("BatchId:", batchId);
  console.log("ProductType:", productType);
  console.log("BackUrl:", backUrl);

  const {
    batchToDelete,
    isDeleting,
    initiateDeletion,
    cancelDeletion,
    handleDeleteBatch
  } = useBatchDeletion({
    productType,
    onSuccess: () => navigate(backUrl)
  });

  useEffect(() => {
    const fetchBatchDetails = async () => {
      if (!batchId) {
        console.log("No batchId provided");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("Fetching batch details for ID:", batchId);
        
        // Fetch batch details
        const { data: batchData, error: batchError } = await supabase
          .from("batches")
          .select("*")
          .eq("id", batchId)
          .single();

        console.log("Batch query result:", { batchData, batchError });

        if (batchError) {
          console.error("Batch fetch error:", batchError);
          throw batchError;
        }

        if (!batchData) {
          console.warn("No batch data found");
          setError("Batch not found");
          return;
        }

        setBatch(batchData);

        // Fetch related business card jobs
        console.log("Fetching business card jobs for batch:", batchId);
        
        const { data: jobsData, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("*")
          .eq("batch_id", batchId);

        console.log("Business card jobs query result:", { 
          jobsData, 
          jobsError, 
          count: jobsData?.length,
          firstJob: jobsData?.[0]
        });

        if (jobsError) {
          console.error("Jobs fetch error:", jobsError);
          throw jobsError;
        }

        // Convert business card jobs to Job format
        const convertedJobs: Job[] = (jobsData || []).map(job => ({
          id: job.id,
          name: job.name || "",
          file_name: job.file_name || "",
          quantity: job.quantity,
          lamination_type: job.lamination_type || "none",
          due_date: job.due_date,
          uploaded_at: job.created_at,
          status: job.status,
          pdf_url: job.pdf_url || "",
          double_sided: job.double_sided || false,
          job_number: job.job_number || "",
          updated_at: job.updated_at,
          user_id: job.user_id,
          paper_type: job.paper_type
        }));

        console.log("Converted jobs:", convertedJobs.length, "jobs");
        setRelatedJobs(convertedJobs);

      } catch (err) {
        console.error("Error fetching batch details:", err);
        setError("Failed to load batch details");
        toast.error("Error loading batch details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchDetails();
  }, [batchId]);

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    setBatchToDelete: initiateDeletion,
    handleDeleteBatch
  };
}
