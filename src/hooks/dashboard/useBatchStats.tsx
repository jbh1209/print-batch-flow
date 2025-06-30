
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBatchStatsCore } from './useBatchStatsCore';

interface BatchStats {
  businessCardBatches: number;
  flyerBatches: number;
  totalBatches: number;
  pendingBatches: number;
  inProgressBatches: number;
  completedBatches: number;
}

export const useBatchStats = () => {
  const [stats, setStats] = useState<BatchStats>({
    businessCardBatches: 0,
    flyerBatches: 0,
    totalBatches: 0,
    pendingBatches: 0,
    inProgressBatches: 0,
    completedBatches: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getJobCountForProductType } = useBatchStatsCore();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get batch statistics
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('status');

        if (batchError) throw batchError;

        // Count batches by status
        const pendingBatches = batchData?.filter(b => b.status === 'pending').length || 0;
        const inProgressBatches = batchData?.filter(b => b.status === 'processing').length || 0;
        const completedBatches = batchData?.filter(b => b.status === 'completed').length || 0;
        const totalBatches = batchData?.length || 0;

        // Get job counts for different product types
        const businessCardBatches = await getJobCountForProductType('business_card_jobs');
        const flyerBatches = await getJobCountForProductType('flyer_jobs');

        setStats({
          businessCardBatches,
          flyerBatches,
          totalBatches,
          pendingBatches,
          inProgressBatches,
          completedBatches
        });

      } catch (err) {
        console.error('Error fetching batch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load batch statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [getJobCountForProductType]);

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
