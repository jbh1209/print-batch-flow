
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BatchStats {
  // Legacy batch counts (Printstream)
  businessCardBatches: number;
  flyerBatches: number;
  totalBatches: number;
  pendingBatches: number;
  inProgressBatches: number;
  completedBatches: number;
  
  // Enhanced batch context for tracker integration
  productionJobsInBatches: number;
  batchMasterJobs: number;
  individualJobsReadyForBatch: number;
  
  // Batch efficiency metrics
  averageBatchSize: number;
  batchCompletionRate: number;
}

export const useBatchStats = () => {
  const [stats, setStats] = useState<BatchStats>({
    businessCardBatches: 0,
    flyerBatches: 0,
    totalBatches: 0,
    pendingBatches: 0,
    inProgressBatches: 0,
    completedBatches: 0,
    productionJobsInBatches: 0,
    batchMasterJobs: 0,
    individualJobsReadyForBatch: 0,
    averageBatchSize: 0,
    batchCompletionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getJobCountForProductType = async (tableName: 'business_card_jobs' | 'flyer_jobs') => {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error(`Error fetching count for ${tableName}:`, err);
      return 0;
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get batch statistics with enhanced metrics
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('id, status, name');

        if (batchError) throw batchError;

        // Count batches by status
        const pendingBatches = batchData?.filter(b => b.status === 'pending').length || 0;
        const inProgressBatches = batchData?.filter(b => b.status === 'processing').length || 0;
        const completedBatches = batchData?.filter(b => b.status === 'completed').length || 0;
        const totalBatches = batchData?.length || 0;

        // Get job counts for different product types
        const businessCardBatches = await getJobCountForProductType('business_card_jobs');
        const flyerBatches = await getJobCountForProductType('flyer_jobs');

        // Get enhanced batch context from production jobs and batch references
        const { data: productionJobs } = await supabase
          .from('production_jobs')
          .select('id, wo_no, status, batch_ready');

        const { data: batchRefs } = await supabase
          .from('batch_job_references')
          .select('production_job_id, batch_id, status');

        // Calculate enhanced metrics
        const batchMasterJobs = productionJobs?.filter(job => job.wo_no?.startsWith('BATCH-')).length || 0;
        const individualJobsReadyForBatch = productionJobs?.filter(job => job.batch_ready === true).length || 0;
        const productionJobsInBatches = batchRefs?.filter(ref => ref.status === 'processing').length || 0;

        // Calculate batch efficiency metrics
        const batchIds = batchData?.map(b => b.id) || [];
        let averageBatchSize = 0;
        let batchCompletionRate = 0;

        if (batchIds.length > 0) {
          // Get batch sizes
          const batchSizes = await Promise.all(
            batchIds.map(async (batchId) => {
              const { count } = await supabase
                .from('batch_job_references')
                .select('*', { count: 'exact' })
                .eq('batch_id', batchId);
              return count || 0;
            })
          );

          averageBatchSize = batchSizes.length > 0 ? 
            Math.round(batchSizes.reduce((sum, size) => sum + size, 0) / batchSizes.length) : 0;

          // Calculate completion rate
          if (totalBatches > 0) {
            batchCompletionRate = Math.round((completedBatches / totalBatches) * 100);
          }
        }

        setStats({
          businessCardBatches,
          flyerBatches,
          totalBatches,
          pendingBatches,
          inProgressBatches,
          completedBatches,
          productionJobsInBatches,
          batchMasterJobs,
          individualJobsReadyForBatch,
          averageBatchSize,
          batchCompletionRate
        });

      } catch (err) {
        console.error('Error fetching enhanced batch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load batch statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return {
    stats,
    isLoading,
    error,
    refetch: () => {
      setIsLoading(true);
      // Re-trigger the effect by updating the dependencies
    }
  };
};
