
import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useGenericBatchDetails } from "@/hooks/generic/useGenericBatchDetails";
import { ProductConfig } from "@/config/productTypes";
import BatchDetailsContent from "@/components/batches/BatchDetailsContent";
import BatchDeleteDialog from "@/components/batches/flyers/BatchDeleteDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenericBatchDetailsPageProps {
  config: ProductConfig;
}

const GenericBatchDetailsPage: React.FC<GenericBatchDetailsPageProps> = ({ config }) => {
  const { batchId = "" } = useParams<{ batchId: string }>();

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

  const handleDeleteClick = () => {
    setBatchToDelete(batchId);
  };

  // Generate title dynamically based on batch name if available
  const pageTitle = useMemo(() => {
    if (batch) {
      return `${batch.name} - ${config.ui.batchFormTitle} Details`;
    }
    return `${config.ui.batchFormTitle} Details`;
  }, [batch, config.ui.batchFormTitle]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!batch) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Batch Not Found</AlertTitle>
        <AlertDescription>
          The requested batch could not be found or has been deleted.
          <div className="mt-2">
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <JobsHeader 
        title={pageTitle}
        subtitle={`View details and manage ${config.ui.title.toLowerCase()} batch`}
      />
      
      <BatchDetailsContent
        batch={batch}
        relatedJobs={relatedJobs}
        productType={config.productType}
        onDeleteClick={handleDeleteClick}
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
