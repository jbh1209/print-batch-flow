
import { useSearchParams } from 'react-router-dom';
import { useFlyerBatches } from '@/hooks/useFlyerBatches';
import { FlyerBatchOverview } from '@/components/flyers/FlyerBatchOverview';
import FlyerBatchLoading from '@/components/flyers/batch-details/FlyerBatchLoading';
import EmptyBatchState from '@/components/flyers/batch-details/EmptyBatchState';
import DeleteBatchDialog from '@/components/flyers/batch-details/DeleteBatchDialog';
import BatchDetailsHeader from '@/components/flyers/batch-details/BatchDetailsHeader';
import BatchDetailsCard from '@/components/batches/BatchDetailsCard';
import BatchActionsCard from '@/components/batches/BatchActionsCard';
import RelatedJobsCard from '@/components/batches/RelatedJobsCard';

const FlyerBatchDetails = () => {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    setBatchToDelete
  } = useFlyerBatches(batchId);

  const batch = batches[0];

  if (isLoading) {
    return <FlyerBatchLoading />;
  }

  if (!batch) {
    return <EmptyBatchState />;
  }

  return (
    <div>
      <BatchDetailsHeader 
        batchName={batch.name}
        onDeleteClick={() => setBatchToDelete(batch.id)}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <BatchDetailsCard 
          batch={batch}
          onDeleteClick={() => setBatchToDelete(batch.id)}
        />
        <BatchActionsCard batch={batch} />
      </div>

      {/* Related Jobs Card and Batch Overview */}
      {batch.jobs && batch.jobs.length > 0 && (
        <>
          <RelatedJobsCard jobs={batch.jobs} />
          <FlyerBatchOverview 
            jobs={batch.jobs} 
            batchName={batch.name} 
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteBatchDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        onClose={() => setBatchToDelete(null)}
        onConfirm={handleDeleteBatch}
      />
    </div>
  );
};

export default FlyerBatchDetails;
