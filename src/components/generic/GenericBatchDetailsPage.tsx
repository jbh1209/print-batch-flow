
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGenericBatchDetails } from "@/hooks/generic/useGenericBatchDetails";
import { ProductConfig, BatchStatus } from "@/config/productTypes";
import BatchDetailsContent from "@/components/batches/BatchDetailsContent";
import BatchDeleteDialog from "@/components/batches/flyers/BatchDeleteDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchDetailsType, Job } from "@/components/batches/types/BatchTypes";

interface GenericBatchDetailsPageProps {
  config: ProductConfig;
  batchId?: string;
}

const GenericBatchDetailsPage: React.FC<GenericBatchDetailsPageProps> = ({ config, batchId: propBatchId }) => {
  const navigate = useNavigate();
  const { batchId: paramBatchId } = useParams<{ batchId: string }>();
  
  // Use the batchId from props or params
  const batchId = propBatchId || paramBatchId;
  
  const {
    batch,
    relatedJobs,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch
  } = useGenericBatchDetails({ batchId, config });

  useEffect(() => {
    console.log("GenericBatchDetailsPage - Batch ID:", batchId);
    console.log("GenericBatchDetailsPage - Product Type:", config.productType);
    console.log("GenericBatchDetailsPage - Batch:", batch);
    console.log("GenericBatchDetailsPage - Related Jobs:", relatedJobs);
  }, [batchId, config, batch, relatedJobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Batch Not Found</AlertTitle>
        <AlertDescription>
          The requested batch could not be found or has been deleted.
          <div className="mt-2">
            <Button 
              variant="outline" 
              onClick={() => navigate(config.routes.batchesPath)}
            >
              Back to Batches
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  console.log("GenericBatchDetailsPage - Rendering batch details for:", batch.name);
  console.log("GenericBatchDetailsPage - PDF URLs:", {
    front: batch.front_pdf_url,
    back: batch.back_pdf_url,
    overview: batch.overview_pdf_url
  });

  // Convert batch to BatchDetailsType to satisfy the component props
  const batchDetailsData: BatchDetailsType = {
    id: batch.id,
    name: batch.name,
    lamination_type: batch.lamination_type,
    sheets_required: batch.sheets_required,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url || batch.back_pdf_url,
    due_date: batch.due_date,
    created_at: batch.created_at,
    status: batch.status as BatchStatus
  };

  // Convert related jobs to match the Job interface, ensuring job_number is included
  const typedRelatedJobs: Job[] = relatedJobs.map(job => ({
    id: job.id,
    name: job.name || '',
    quantity: job.quantity || 0,
    status: job.status,
    pdf_url: job.pdf_url || null,
    job_number: job.job_number || `JOB-${job.id.substring(0, 6)}` // Ensure job_number is always provided
  }));

  return (
    <div>
      <JobsHeader 
        title={`${batch.name} - ${config.ui.batchFormTitle || 'Batch'} Details`}
        subtitle={`View details and manage ${config.ui.title ? config.ui.title.toLowerCase() : 'batch'}`}
      />
      
      <BatchDetailsContent
        batch={batchDetailsData}
        relatedJobs={typedRelatedJobs}
        productType={config.productType}
        onDeleteClick={() => setBatchToDelete(batch.id)}
        onRefresh={() => window.location.reload()}
      />

      <BatchDeleteDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        onClose={() => setBatchToDelete(null)}
        onConfirmDelete={handleDeleteBatch}
      />
    </div>
  );
};

export default GenericBatchDetailsPage;
