import { useParams } from 'react-router-dom';
import { useState } from 'react';
import FlyerBatchLoading from '@/components/flyers/batch-details/FlyerBatchLoading';
import EmptyBatchState from '@/components/flyers/batch-details/EmptyBatchState';
import DeleteBatchDialog from '@/components/flyers/batch-details/DeleteBatchDialog';
import BatchDetailsHeader from '@/components/flyers/batch-details/BatchDetailsHeader';
import BatchDetailsContent from '@/components/batches/BatchDetailsContent';
import { FlyerBatchOverview } from '@/components/flyers/FlyerBatchOverview';
import { useFlyerBatchDetails } from '@/hooks/flyers/useFlyerBatchDetails';
import { useBatchDeletion } from '@/hooks/useBatchDeletion';
import { 
  convertFlyerBatchToBatchDetails, 
  convertFlyerJobsToJobs, 
  convertFlyerJobsToBaseJobs 
} from '@/utils/flyers/typeGuards';

const FlyerBatchDetails = () => {
  const { batchId } = useParams();
  
  console.log('FlyerBatchDetails - batchId from params:', batchId);
  
  const {
    batch,
    relatedJobs,
    isLoading,
    error,
    refetch
  } = useFlyerBatchDetails(batchId);

  const {
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    initiateDeletion,
    cancelDeletion
  } = useBatchDeletion({
    productType: "Flyers",
    onSuccess: refetch
  });

  // Show loading state
  if (isLoading) {
    console.log('Still loading batch details...');
    return <FlyerBatchLoading />;
  }

  // Show error state
  if (error) {
    console.error('Error in FlyerBatchDetails:', error);
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Batch</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500 mb-4">Batch ID: {batchId || 'undefined'}</p>
          <button 
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show empty state if no batch found
  if (!batch) {
    console.log('No batch found for ID:', batchId);
    return <EmptyBatchState />;
  }

  // Convert data safely using type guards
  let batchDetails;
  let convertedJobs;
  let convertedBaseJobs;

  try {
    batchDetails = convertFlyerBatchToBatchDetails(batch);
    convertedJobs = convertFlyerJobsToJobs(relatedJobs);
    convertedBaseJobs = convertFlyerJobsToBaseJobs(relatedJobs);
  } catch (conversionError) {
    console.error('Type conversion error:', conversionError);
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Data Format Error</h2>
          <p className="text-gray-600 mb-4">There was an issue processing the batch data.</p>
          <button 
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  console.log('Rendering batch details for:', batch.name);

  return (
    <div>
      <BatchDetailsHeader 
        batchName={batch.name}
        onDeleteClick={() => initiateDeletion(batch.id)}
      />

      <BatchDetailsContent
        batch={batchDetails}
        relatedJobs={convertedJobs}
        productType="Flyers"
        onDeleteClick={() => initiateDeletion(batch.id)}
        onRefresh={refetch}
      />

      {/* Flyer-specific batch overview */}
      {relatedJobs && relatedJobs.length > 0 && (
        <FlyerBatchOverview 
          jobs={convertedBaseJobs} 
          batchName={batch.name} 
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteBatchDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        onClose={cancelDeletion}
        onConfirm={handleDeleteBatch}
      />
    </div>
  );
};

export default FlyerBatchDetails;
