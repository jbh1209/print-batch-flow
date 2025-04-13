
import { useSearchParams } from "react-router-dom";
import { useBusinessCardBatches } from "@/hooks/useBusinessCardBatches";
import JobsHeader from "@/components/business-cards/JobsHeader";
import BatchDetails from "@/components/batches/BatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import BatchDeleteDialog from "@/components/batches/business-cards/BatchDeleteDialog";

const BusinessCardBatches = () => {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const {
    batches,
    isLoading,
    batchToDelete,
    isDeleting,
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    setBatchToDelete
  } = useBusinessCardBatches(batchId);

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    return (
      <BatchDetails 
        batchId={batchId} 
        productType="Business Cards" 
        backUrl="/batches/business-cards/batches" 
      />
    );
  }

  return (
    <div>
      <JobsHeader 
        title="Business Card Batches" 
        subtitle="View and manage all your business card batches" 
      />

      <BatchesWrapper 
        batches={batches}
        isLoading={isLoading}
        onRefresh={fetchBatches}
        onViewPDF={handleViewPDF}
        onDeleteBatch={setBatchToDelete}
      />

      {/* Delete Confirmation Dialog */}
      <BatchDeleteDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        onClose={() => setBatchToDelete(null)}
        onConfirmDelete={handleDeleteBatch}
      />
    </div>
  );
};

export default BusinessCardBatches;
