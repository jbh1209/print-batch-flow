
import { useParams } from 'react-router-dom';
import { useFlyerBatches } from '@/hooks/useFlyerBatches';
import { FlyerBatchOverview } from '@/components/flyers/FlyerBatchOverview';
import FlyerBatchLoading from '@/components/flyers/batch-details/FlyerBatchLoading';
import EmptyBatchState from '@/components/flyers/batch-details/EmptyBatchState';
import DeleteBatchDialog from '@/components/flyers/batch-details/DeleteBatchDialog';
import BatchDetailsHeader from '@/components/flyers/batch-details/BatchDetailsHeader';
import BatchDetailsCard from '@/components/batches/BatchDetailsCard';
import BatchActionsCard from '@/components/batches/BatchActionsCard';
import RelatedJobsCard from '@/components/batches/RelatedJobsCard';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { Job, BatchDetailsType } from '@/components/batches/types/BatchTypes';

const FlyerBatchDetails = () => {
  const { batchId } = useParams(); // Use path parameter instead of query parameter
  const [relatedJobs, setRelatedJobs] = useState<FlyerJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  
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

  // Fetch related jobs for the current batch
  useEffect(() => {
    async function fetchRelatedJobs() {
      if (!batchId) return;
      
      setIsLoadingJobs(true);
      
      try {
        const { data, error } = await supabase
          .from('flyer_jobs')
          .select('*')
          .eq('batch_id', batchId);
          
        if (error) throw error;
        
        setRelatedJobs(data || []);
      } catch (err) {
        console.error('Error fetching related jobs:', err);
      } finally {
        setIsLoadingJobs(false);
      }
    }
    
    if (batch) {
      fetchRelatedJobs();
    }
  }, [batchId, batch]);

  if (isLoading || isLoadingJobs) {
    return <FlyerBatchLoading />;
  }

  if (!batch) {
    return <EmptyBatchState />;
  }

  // Convert FlyerJob[] to Job[] to satisfy component props
  const convertedJobs: Job[] = relatedJobs.map(job => ({
    id: job.id,
    name: job.name,
    file_name: job.file_name || job.name || "",
    quantity: job.quantity,
    lamination_type: "none", // Default for flyers
    due_date: job.due_date,
    uploaded_at: job.created_at, // Use created_at as uploaded_at
    status: job.status,
    pdf_url: job.pdf_url,
    user_id: job.user_id,
    updated_at: job.updated_at,
    job_number: job.job_number || job.name
  }));

  // Convert FlyerBatch to BatchDetailsType for compatibility
  const batchDetails: BatchDetailsType = {
    id: batch.id,
    name: batch.name,
    lamination_type: batch.lamination_type,
    sheets_required: batch.sheets_required,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url || batch.back_pdf_url,
    due_date: batch.due_date,
    created_at: batch.created_at,
    status: batch.status as any // Force casting until we align enums
  };

  return (
    <div>
      <BatchDetailsHeader 
        batchName={batch.name}
        onDeleteClick={() => setBatchToDelete(batch.id)}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <BatchDetailsCard 
          batch={batchDetails}
          onDeleteClick={() => setBatchToDelete(batch.id)}
        />
        <BatchActionsCard batch={batchDetails} />
      </div>

      {/* Related Jobs Card and Batch Overview */}
      {relatedJobs && relatedJobs.length > 0 && (
        <>
          <RelatedJobsCard jobs={convertedJobs} />
          <FlyerBatchOverview 
            jobs={relatedJobs} 
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
