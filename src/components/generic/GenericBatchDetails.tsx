
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGenericBatchDetails } from "@/hooks/generic/useGenericBatchDetails";
import { ProductConfig } from "@/config/productTypes";
import BatchDetailsContent from "@/components/batches/BatchDetailsContent";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import BatchDeleteDialog from "@/components/batches/flyers/BatchDeleteDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { BatchDetailsType, Job, JobStatus } from "@/components/batches/types/BatchTypes";
import { LaminationType } from "@/components/batches/types/FlyerTypes";

interface GenericBatchDetailsProps {
  batchId: string;
  config: ProductConfig;
}

const GenericBatchDetails: React.FC<GenericBatchDetailsProps> = ({ batchId, config }) => {
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
  
  // Convert batch to BatchDetailsType to satisfy the component props
  const batchDetailsData: BatchDetailsType = {
    id: batch.id,
    name: batch.name,
    lamination_type: (batch.lamination_type as LaminationType) || 'none',
    sheets_required: batch.sheets_required,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url,
    due_date: batch.due_date,
    created_at: batch.created_at,
    status: batch.status // Both are now string-based types
  };

  // Convert BaseJob[] to Job[] by adding required properties and correctly typing the status
  const jobsWithRequiredProps: Job[] = relatedJobs.map(job => ({
    ...job,
    file_name: job.file_name || "",
    lamination_type: (job.lamination_type as LaminationType) || "none",
    due_date: job.due_date || new Date().toISOString(),
    uploaded_at: job.created_at || new Date().toISOString(),
    // Safely access the double_sided property with a fallback
    double_sided: job.double_sided !== undefined ? job.double_sided : false,
    job_number: job.job_number || "",
    updated_at: job.updated_at || new Date().toISOString(),
    user_id: job.user_id || "",
    // Explicitly cast the status to JobStatus type
    status: job.status as JobStatus
  }));

  return (
    <div>
      <JobsHeader 
        title={`${batch.name} - ${config.ui.batchFormTitle || 'Batch'} Details`}
        subtitle={`View details and manage ${config.ui.title ? config.ui.title.toLowerCase() : 'batch'}`}
      />
      
      <BatchDetailsContent
        batch={batchDetailsData}
        relatedJobs={jobsWithRequiredProps}
        productType={config.productType}
        onDeleteClick={() => setBatchToDelete(batch.id)}
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

export default GenericBatchDetails;
