
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useJobSpecificationDisplay } from '@/hooks/useJobSpecificationDisplay';

interface BatchJob {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  due_date: string;
  uploaded_at: string;
  status: string;
  pdf_url: string;
  user_id: string;
  updated_at: string;
  job_number: string;
  double_sided?: boolean;
  single_sided?: boolean;
}

interface BatchDetails {
  id: string;
  name: string;
  lamination_type: string;
  sheets_required: number;
  front_pdf_url?: string;
  back_pdf_url?: string;
  overview_pdf_url?: string;
  due_date: string;
  created_at: string;
  status: string;
}

export const useBatchDetails = (batchId: string | null) => {
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getJobSpecifications } = useJobSpecificationDisplay();

  useEffect(() => {
    if (!batchId) {
      setIsLoading(false);
      return;
    }

    const fetchBatchDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch batch details
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('*')
          .eq('id', batchId)
          .single();

        if (batchError) throw batchError;

        setBatch({
          id: batchData.id,
          name: batchData.name,
          lamination_type: batchData.lamination_type || 'none',
          sheets_required: batchData.sheets_required,
          front_pdf_url: batchData.front_pdf_url,
          back_pdf_url: batchData.back_pdf_url,
          overview_pdf_url: batchData.overview_pdf_url,
          due_date: batchData.due_date,
          created_at: batchData.created_at,
          status: batchData.status
        });

        // Fetch associated jobs from business_card_jobs
        const { data: businessCardJobs, error: businessCardError } = await supabase
          .from('business_card_jobs')
          .select('*')
          .eq('batch_id', batchId);

        if (businessCardError) throw businessCardError;

        // Convert to BatchJob format and add specifications
        const formattedJobs = await Promise.all(
          (businessCardJobs || []).map(async (job) => {
            const specifications = await getJobSpecifications(job.id, 'business_card_jobs');
            
            return {
              id: job.id,
              name: job.name,
              file_name: job.file_name,
              quantity: job.quantity,
              due_date: job.due_date,
              uploaded_at: job.uploaded_at,
              status: job.status,
              pdf_url: job.pdf_url,
              user_id: job.user_id,
              updated_at: job.updated_at,
              job_number: job.job_number,
              double_sided: job.double_sided,
              // Add specifications as computed properties
              ...specifications
            };
          })
        );

        setJobs(formattedJobs);

      } catch (err) {
        console.error('Error fetching batch details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load batch details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchDetails();
  }, [batchId, getJobSpecifications]);

  return {
    batch,
    jobs,
    isLoading,
    error,
    refetch: () => {
      if (batchId) {
        // Trigger re-fetch by changing the dependency
      }
    }
  };
};
