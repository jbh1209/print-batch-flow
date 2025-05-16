
import { useParams, useNavigate } from 'react-router-dom';
import { useFlyerBatches } from '@/hooks/useFlyerBatches';
import { FlyerBatchOverview } from '@/components/flyers/FlyerBatchOverview';
import FlyerBatchLoading from '@/components/flyers/batch-details/FlyerBatchLoading';
import EmptyBatchState from '@/components/flyers/batch-details/EmptyBatchState';
import BatchDetailsHeader from '@/components/flyers/batch-details/BatchDetailsHeader';
import BatchDetailsCard from '@/components/batches/BatchDetailsCard';
import BatchActionsCard from '@/components/batches/BatchActionsCard';
import RelatedJobsCard from '@/components/batches/RelatedJobsCard';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { Job, LaminationType } from '@/components/batches/types/BatchTypes';
import BatchDeleteDialog from '@/components/batches/DeleteBatchDialog';

const FlyerBatchDetails = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
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
  } = useFlyerBatches(batchId || null);

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

  // Add debugging logs
  useEffect(() => {
    console.log("FlyerBatchDetails - Batch ID:", batchId);
    console.log("Loaded batch data:", batch);
  }, [batchId, batch]);

  if (isLoading || isLoadingJobs) {
    return <FlyerBatchLoading />;
  }

  if (!batch) {
    return <EmptyBatchState />;
  }

  // Convert FlyerJob[] to Job[] with required fields
  const convertedJobs: Job[] = relatedJobs.map(job => ({
    id: job.id,
    name: job.name,
    quantity: job.quantity,
    status: job.status,
    pdf_url: job.pdf_url,
    job_number: job.job_number,
    file_name: job.file_name || `job-${job.id.substring(0, 6)}.pdf`, // Required field
    uploaded_at: job.uploaded_at || job.created_at || new Date().toISOString(), // Required field
    lamination_type: "none" as LaminationType, // Required field with default value
    size: typeof job.size === 'string' ? job.size : String(job.size) // Convert to string if needed
  }));

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
      {relatedJobs && relatedJobs.length > 0 && (
        <>
          <RelatedJobsCard jobs={convertedJobs} />
          <FlyerBatchOverview 
            jobs={relatedJobs} 
            batchName={batch.name} 
          />
        </>
      )}

      {/* Delete Confirmation Dialog - Use consistent component & props */}
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

export default FlyerBatchDetails;
