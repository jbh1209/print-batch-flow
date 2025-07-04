import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AccessibleJob } from "./useAccessibleJobs/types";

interface ConstituentJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  reference: string;
  category_name: string;
  category_color: string;
  qty: number;
}

/**
 * Hook to fetch constituent jobs for a batch master job
 */
export const useBatchConstituentJobs = (batchName: string | null) => {
  const { user } = useAuth();

  const {
    data: constituentJobs = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['batch-constituent-jobs', batchName, user?.id],
    queryFn: async () => {
      if (!batchName || !user?.id) {
        return [];
      }

      console.log('🔄 Fetching constituent jobs for batch:', batchName);

      // First get the batch ID from the batch name
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('id')
        .eq('name', batchName)
        .single();

      if (batchError || !batch) {
        console.warn('⚠️ Could not find batch:', batchName);
        return [];
      }

      // Get constituent jobs via batch_job_references
      const { data: batchRefs, error: refsError } = await supabase
        .from('batch_job_references')
        .select(`
          production_job_id,
          production_jobs (
            id,
            wo_no,
            customer,
            status,
            due_date,
            reference,
            qty,
            categories (
              name,
              color
            )
          )
        `)
        .eq('batch_id', batch.id)
        .eq('status', 'processing');

      if (refsError) {
        console.error('❌ Error fetching batch references:', refsError);
        throw refsError;
      }

      return (batchRefs || []).map(ref => ({
        id: ref.production_jobs?.id || '',
        wo_no: ref.production_jobs?.wo_no || '',
        customer: ref.production_jobs?.customer || 'Unknown',
        status: ref.production_jobs?.status || 'Unknown',
        due_date: ref.production_jobs?.due_date || '',
        reference: ref.production_jobs?.reference || '',
        category_name: ref.production_jobs?.categories?.name || 'No Category',
        category_color: ref.production_jobs?.categories?.color || '#6B7280',
        qty: ref.production_jobs?.qty || 0
      })).filter(job => job.id); // Filter out invalid jobs
    },
    enabled: !!batchName && !!user?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  return {
    constituentJobs,
    isLoading,
    error: error?.message || null,
    refetch
  };
};