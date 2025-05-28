
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
import { BatchOverviewGenerator } from '@/components/batches/BatchOverviewGenerator';
import { useBatchPdfDownloads } from '@/components/batches/BatchPdfDownloads';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { Job, BatchDetailsType } from '@/components/batches/types/BatchTypes';
import { BaseJob } from '@/config/productTypes';

const FlyerBatchDetails = () => {
  const { batchId } = useParams();
  const [relatedJobs, setRelatedJobs] = useState<FlyerJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  
  const {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    setBatchToDelete,
    fetchBatches
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

  // Convert FlyerJob[] to Job[] and BaseJob[] for compatibility
  const convertedJobs: Job[] = relatedJobs.map(job => ({
    id: job.id,
    name: job.name,
    file_name: job.file_name || job.name || "",
    quantity: job.quantity,
    lamination_type: "none",
    due_date: job.due_date,
    uploaded_at: job.created_at,
    status: job.status,
    pdf_url: job.pdf_url,
    user_id: job.user_id || "",
    updated_at: job.updated_at || "",
    job_number: job.job_number || job.name || ""
  }));

  const convertToBaseJobs = (jobs: Job[]): BaseJob[] => {
    return jobs.map(job => ({
      ...job,
      paper_type: relatedJobs.find(fj => fj.id === job.id)?.paper_type || "",
      paper_weight: relatedJobs.find(fj => fj.id === job.id)?.paper_weight || "",
      size: relatedJobs.find(fj => fj.id === job.id)?.size || ""
    })) as unknown as BaseJob[];
  };

  // Convert FlyerBatch to BatchDetailsType for compatibility
  const batchDetails: BatchDetailsType | null = batch ? {
    id: batch.id,
    name: batch.name,
    lamination_type: batch.lamination_type,
    sheets_required: batch.sheets_required,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url || batch.back_pdf_url,
    due_date: batch.due_date,
    created_at: batch.created_at,
    status: batch.status
  } : null;

  // Initialize batch overview and PDF download functionality
  const { convertToBaseJobs: overviewConverter } = batchDetails ? BatchOverviewGenerator({ 
    batch: batchDetails, 
    relatedJobs: convertedJobs,
    onRefresh: fetchBatches
  }) : { convertToBaseJobs: () => [] };

  const {
    handleDownloadJobPdfs,
    handleDownloadIndividualJobPdfs,
    handleDownloadBatchOverviewSheet
  } = batchDetails ? useBatchPdfDownloads({ 
    batch: batchDetails, 
    relatedJobs: convertedJobs, 
    convertToBaseJobs
  }) : {
    handleDownloadJobPdfs: async () => {},
    handleDownloadIndividualJobPdfs: async () => {},
    handleDownloadBatchOverviewSheet: async () => {}
  };

  if (isLoading || isLoadingJobs) {
    return <FlyerBatchLoading />;
  }

  if (!batch || !batchDetails) {
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
          batch={batchDetails}
          onDeleteClick={() => setBatchToDelete(batch.id)}
        />
        <BatchActionsCard 
          batch={batchDetails}
          onDownloadJobPdfs={handleDownloadJobPdfs}
          onDownloadIndividualJobPdfs={handleDownloadIndividualJobPdfs}
          onDownloadBatchOverviewSheet={handleDownloadBatchOverviewSheet}
        />
      </div>

      {/* Related Jobs Card and Batch Overview */}
      {relatedJobs && relatedJobs.length > 0 && (
        <>
          <RelatedJobsCard jobs={convertedJobs} />
          <FlyerBatchOverview 
            jobs={convertToBaseJobs(convertedJobs)} 
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
