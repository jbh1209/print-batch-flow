
import React from "react";
import { useNavigate } from "react-router-dom";
import { useGenericBatchDetails } from "@/hooks/generic/useGenericBatchDetails";
import { ProductConfig } from "@/config/productTypes";
import BatchDetailsContent from "@/components/batches/BatchDetailsContent";
import BatchDeleteDialog from "@/components/batches/flyers/BatchDeleteDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlyerBatchOverview } from "@/components/flyers/FlyerBatchOverview";

interface GenericBatchDetailsPageProps {
  config: ProductConfig;
  batchId: string;
}

const GenericBatchDetailsPage: React.FC<GenericBatchDetailsPageProps> = ({ config, batchId }) => {
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

      {/* Always show Batch Overview if there are jobs */}
      {relatedJobs.length > 0 && (
        <FlyerBatchOverview 
          jobs={relatedJobs}
          batchName={batch.name}
        />
      )}

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
