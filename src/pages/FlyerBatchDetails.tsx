
import { useParams } from 'react-router-dom';
import { useFlyerBatches } from '@/hooks/useFlyerBatches';
import { FlyerBatchOverview } from '@/components/flyers/FlyerBatchOverview';
import FlyerBatchLoading from '@/components/flyers/batch-details/FlyerBatchLoading';
import EmptyBatchState from '@/components/flyers/batch-details/EmptyBatchState';
import DeleteBatchDialog from '@/components/flyers/batch-details/DeleteBatchDialog';
import BatchDetailsHeader from '@/components/flyers/batch-details/BatchDetailsHeader';
import BatchDetailsContent from '@/components/batches/BatchDetailsContent';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { FlyerJob, FlyerBatch } from '@/components/batches/types/FlyerTypes';
import { Job, BatchDetailsType } from '@/components/batches/types/BatchTypes';
import { BaseJob } from '@/config/productTypes';

const FlyerBatchDetails = () => {
  const { id: batchId } = useParams();
  const [relatedJobs, setRelatedJobs] = useState<FlyerJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  console.log('FlyerBatchDetails - batchId from params:', batchId);
  
  const {
    batches,
    isLoading,
    error: batchError,
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    setBatchToDelete,
    fetchBatches
  } = useFlyerBatches(batchId || null);

  console.log('FlyerBatchDetails - batches:', batches);
  console.log('FlyerBatchDetails - isLoading:', isLoading);
  console.log('FlyerBatchDetails - batchError:', batchError);

  const batch = batches[0];

  // Fetch related jobs for the current batch
  useEffect(() => {
    async function fetchRelatedJobs() {
      if (!batchId) {
        console.log('No batchId provided');
        return;
      }
      
      setIsLoadingJobs(true);
      setError(null);
      
      try {
        console.log('Fetching related jobs for batch:', batchId);
        const { data, error } = await supabase
          .from('flyer_jobs')
          .select('*')
          .eq('batch_id', batchId);
          
        if (error) throw error;
        
        console.log('Related jobs fetched:', data?.length || 0);
        setRelatedJobs(data || []);
      } catch (err) {
        console.error('Error fetching related jobs:', err);
        setError('Failed to load related jobs');
      } finally {
        setIsLoadingJobs(false);
      }
    }
    
    if (batch) {
      fetchRelatedJobs();
    }
  }, [batchId, batch]);

  // Helper function to safely convert FlyerJob to Job with proper error handling
  const convertFlyerJobsToJobs = (flyerJobs: FlyerJob[]): Job[] => {
    try {
      return flyerJobs.map(job => ({
        id: job.id,
        name: job.name,
        file_name: job.file_name || job.name || "",
        quantity: job.quantity,
        lamination_type: "none", // Default for flyers
        due_date: job.due_date,
        uploaded_at: job.created_at,
        status: job.status,
        pdf_url: job.pdf_url,
        user_id: job.user_id || "",
        updated_at: job.updated_at || "",
        job_number: job.job_number || job.name || ""
      }));
    } catch (error) {
      console.error('Error converting flyer jobs to jobs:', error);
      return [];
    }
  };

  // Helper function to safely convert FlyerBatch to BatchDetailsType
  const convertFlyerBatchToBatchDetails = (flyerBatch: FlyerBatch): BatchDetailsType | null => {
    try {
      return {
        id: flyerBatch.id,
        name: flyerBatch.name,
        lamination_type: flyerBatch.lamination_type,
        sheets_required: flyerBatch.sheets_required,
        front_pdf_url: flyerBatch.front_pdf_url,
        back_pdf_url: flyerBatch.back_pdf_url,
        overview_pdf_url: flyerBatch.overview_pdf_url || flyerBatch.back_pdf_url,
        due_date: flyerBatch.due_date,
        created_at: flyerBatch.created_at,
        status: flyerBatch.status
      };
    } catch (error) {
      console.error('Error converting flyer batch to batch details:', error);
      return null;
    }
  };

  // Show loading state
  if (isLoading || isLoadingJobs) {
    console.log('Still loading...');
    return <FlyerBatchLoading />;
  }

  // Show error state with more details
  if (batchError || error) {
    const displayError = batchError || error;
    console.log('Error occurred:', displayError);
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Batch</h2>
          <p className="text-gray-600 mb-4">{displayError}</p>
          <p className="text-sm text-gray-500 mb-4">Batch ID: {batchId || 'undefined'}</p>
          <button 
            onClick={fetchBatches}
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

  // Convert batch and jobs with error handling
  const batchDetails = convertFlyerBatchToBatchDetails(batch);
  const convertedJobs = convertFlyerJobsToJobs(relatedJobs);

  if (!batchDetails) {
    console.error('Failed to convert batch details');
    return <EmptyBatchState />;
  }

  console.log('Rendering batch details for:', batch.name);

  return (
    <div>
      <BatchDetailsHeader 
        batchName={batch.name}
        onDeleteClick={() => setBatchToDelete(batch.id)}
      />

      <BatchDetailsContent
        batch={batchDetails}
        relatedJobs={convertedJobs}
        productType="Flyers"
        onDeleteClick={() => setBatchToDelete(batch.id)}
        onRefresh={fetchBatches}
      />

      {/* Flyer-specific batch overview */}
      {relatedJobs && relatedJobs.length > 0 && (
        <FlyerBatchOverview 
          jobs={convertedJobs.map(job => ({
            ...job,
            paper_type: relatedJobs.find(fj => fj.id === job.id)?.paper_type || "",
            paper_weight: relatedJobs.find(fj => fj.id === job.id)?.paper_weight || "",
            size: relatedJobs.find(fj => fj.id === job.id)?.size || ""
          })) as unknown as BaseJob[]} 
          batchName={batch.name} 
        />
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
