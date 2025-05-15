
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGenericBatchDetails } from "@/hooks/generic/useGenericBatchDetails";
import { ProductConfig, BatchStatus } from "@/config/productTypes";
import BatchDetailsContent from "@/components/batches/BatchDetailsContent";
import BatchDeleteDialog from "@/components/batches/DeleteBatchDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchDetailsType, Job } from "@/components/batches/types/BatchTypes";

interface GenericBatchDetailsProps {
  config: ProductConfig;
  batchId: string;
}

const GenericBatchDetails: React.FC<GenericBatchDetailsProps> = ({ config, batchId }) => {
  const navigate = useNavigate();
  
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
    console.log("GenericBatchDetails - Batch ID:", batchId);
    console.log("GenericBatchDetails - Product Type:", config.productType);
  }, [batchId, config]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-b-2 border-primary rounded-full"></div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading batch details</AlertTitle>
        <AlertDescription>
          {error || "Batch not found"}
          <div className="mt-2">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/batches/${config.productType.toLowerCase()}`)}
            >
              Back to Batches
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  console.log("Rendering batch details for:", batch.name, "with related jobs:", relatedJobs.length);

  // Convert batch to BatchDetailsType to satisfy the component props
  const batchDetailsData: BatchDetailsType = {
    id: batch.id,
    name: batch.name,
    lamination_type: batch.lamination_type,
    sheets_required: batch.sheets_required,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url || null,
    due_date: batch.due_date,
    created_at: batch.created_at,
    status: batch.status as BatchStatus
  };

  // Convert jobs to the expected type
  const convertedJobs: Job[] = relatedJobs.map(job => ({
    id: job.id,
    name: job.name,
    job_number: job.job_number,
    due_date: job.due_date,
    quantity: job.quantity,
    status: job.status,
    pdf_url: job.pdf_url
  }));

  return (
    <div>
      <JobsHeader 
        title={`${batch.name} - ${config.ui?.batchFormTitle || 'Batch'} Details`}
        subtitle={`View details and manage ${config.ui?.title ? config.ui.title.toLowerCase() : 'batch'}`}
      />
      
      <BatchDetailsContent
        batch={batchDetailsData}
        relatedJobs={convertedJobs}
        productType={config.productType}
        onDeleteClick={() => setBatchToDelete(batch.id)}
      />
      
      {/* Use the standardized BatchDeleteDialog */}
      <BatchDeleteDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        batchName={batch.name}
        onClose={() => setBatchToDelete(null)}
        onConfirmDelete={handleDeleteBatch}
      />
    </div>
  );
};

export default GenericBatchDetails;
