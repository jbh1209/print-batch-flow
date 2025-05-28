
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerBatch, FlyerJob } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';

export function useFlyerBatchDetails(batchId: string | undefined) {
  const { user } = useAuth();
  const [batch, setBatch] = useState<FlyerBatch | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<FlyerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatchDetails = async () => {
    if (!batchId) {
      setError('No batch ID provided');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching batch details for ID:', batchId);

      // Fetch batch data
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .ilike('name', 'DXB-FL-%')
        .single();

      if (batchError) {
        console.error('Batch fetch error:', batchError);
        throw new Error(`Failed to load batch: ${batchError.message}`);
      }

      if (!batchData) {
        throw new Error('Batch not found');
      }

      // Convert to FlyerBatch with safe property mapping
      const flyerBatch: FlyerBatch = {
        id: batchData.id,
        name: batchData.name,
        status: batchData.status,
        sheets_required: batchData.sheets_required || 0,
        front_pdf_url: batchData.front_pdf_url,
        back_pdf_url: batchData.back_pdf_url,
        overview_pdf_url: batchData.overview_pdf_url,
        due_date: batchData.due_date,
        created_at: batchData.created_at,
        lamination_type: batchData.lamination_type,
        paper_type: batchData.paper_type || '',
        paper_weight: batchData.paper_weight || '',
        sheet_size: batchData.sheet_size || '',
        printer_type: batchData.printer_type || '',
        created_by: batchData.created_by,
        updated_at: batchData.updated_at,
        date_created: batchData.date_created
      };

      setBatch(flyerBatch);

      // Fetch related jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('flyer_jobs')
        .select('*')
        .eq('batch_id', batchId);

      if (jobsError) {
        console.error('Jobs fetch error:', jobsError);
        // Don't throw here, batch can exist without jobs
        toast.error('Failed to load related jobs');
        setRelatedJobs([]);
      } else {
        setRelatedJobs(jobsData || []);
      }

      console.log('Successfully fetched batch and jobs:', {
        batch: flyerBatch.name,
        jobsCount: jobsData?.length || 0
      });

    } catch (err) {
      console.error('Error in fetchBatchDetails:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchDetails();
  }, [batchId, user]);

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    refetch: fetchBatchDetails
  };
}
