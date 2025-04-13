
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";
import DeleteBatchDialog from "./DeleteBatchDialog";

interface BatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string;
}

const BatchDetails = ({ batchId, productType, backUrl }: BatchDetailsProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batch, setBatch] = useState<BatchDetailsType | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (batchId && user) {
      fetchBatchDetails();
    }
  }, [batchId, user]);

  const fetchBatchDetails = async () => {
    if (!user || !batchId) return;
    
    setIsLoading(true);
    try {
      // Fetch batch details
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", batchId)
        .eq("created_by", user.id)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Batch not found",
          description: "The requested batch could not be found or you don't have permission to view it.",
          variant: "destructive",
        });
        navigate(backUrl);
        return;
      }
      
      setBatch(data as BatchDetailsType);
      
      // Fetch related jobs based on product type
      let jobsData: Job[] = [];
      
      // Determine which table to query based on product type
      // Currently only business cards have a dedicated table
      if (productType === "Business Cards") {
        const { data: jobs, error: jobsError } = await supabase
          .from("business_card_jobs")
          .select("id, name, quantity, status, pdf_url")
          .eq("batch_id", batchId)
          .order("name");
        
        if (jobsError) throw jobsError;
        jobsData = jobs || [];
      }
      
      setRelatedJobs(jobsData);
    } catch (error) {
      console.error("Error fetching batch details:", error);
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
      // First update all jobs in this batch back to queued
      if (productType === "Business Cards") {
        const { error: jobsError } = await supabase
          .from("business_card_jobs")
          .update({ status: "queued", batch_id: null })
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

  const handleViewPDF = (url: string | null) => {
    if (url) {
      // Open PDF directly in a new tab
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-gray-400" />
        <p>Loading batch details...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
        <p className="text-gray-500 mb-4">The requested batch could not be found or you don't have permission to view it.</p>
        <Button onClick={() => navigate(backUrl)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button
          onClick={() => navigate(backUrl)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Batches
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <BatchDetailsCard batch={batch} handleViewPDF={handleViewPDF} onDeleteClick={() => setBatchToDelete(batch.id)} />
        <BatchActionsCard batch={batch} handleViewPDF={handleViewPDF} />
      </div>

      {/* Related Jobs */}
      {productType === "Business Cards" && relatedJobs.length > 0 && (
        <RelatedJobsCard jobs={relatedJobs} handleViewPDF={handleViewPDF} />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteBatchDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        onCancel={() => setBatchToDelete(null)}
        onDelete={handleDeleteBatch}
      />
    </div>
  );
};

export default BatchDetails;
