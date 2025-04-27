
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  }, [batchId, config]);

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

  console.log("Rendering batch details for:", batch.name, "with related jobs:", relatedJobs.length);

  return (
    <div>
      <JobsHeader 
        title={`${batch.name} - ${config.ui.batchFormTitle} Details`}
        subtitle={`View details and manage ${config.ui.title.toLowerCase()} batch`}
      />
      
      <BatchDetailsContent
        batch={batch}
        relatedJobs={relatedJobs}
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

export default GenericBatchDetailsPage;
