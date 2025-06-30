
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface BatchStats {
  totalBatches: number;
  pendingBatches: number;
  inProgressBatches: number;
  completedBatches: number;
  totalJobs: number;
  averageJobsPerBatch: number;
}

const JOB_TABLES = [
  'business_card_jobs',
  'flyer_jobs', 
  'sleeve_jobs',
  'box_jobs',
  'cover_jobs',
  'poster_jobs',
  'postcard_jobs',
  'sticker_jobs'
] as const;

export const useBatchStatsCore = () => {
  const [stats, setStats] = useState<BatchStats>({
    totalBatches: 0,
    pendingBatches: 0,
    inProgressBatches: 0,
    completedBatches: 0,
    totalJobs: 0,
    averageJobsPerBatch: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get batch statistics
        const { data: batches, error: batchError } = await supabase
          .from('batches')
          .select('id, status');

        if (batchError) throw batchError;

        // Count total jobs across all batch job tables
        let totalJobs = 0;
        for (const table of JOB_TABLES) {
          try {
            const { count, error } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            
            if (!error && count) {
              totalJobs += count;
            }
          } catch (tableError) {
            console.warn(`Error counting jobs in ${table}:`, tableError);
          }
        }

        const batchCount = batches?.length || 0;
        const pendingCount = batches?.filter(b => b.status === 'pending').length || 0;
        const processingCount = batches?.filter(b => b.status === 'processing').length || 0;
        const completedCount = batches?.filter(b => b.status === 'completed').length || 0;

        setStats({
          totalBatches: batchCount,
          pendingBatches: pendingCount,
          inProgressBatches: processingCount,
          completedBatches: completedCount,
          totalJobs,
          averageJobsPerBatch: batchCount > 0 ? Math.round(totalJobs / batchCount) : 0
        });

      } catch (err) {
        console.error('Error fetching batch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load batch statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchStats();
  }, []);

  return { stats, isLoading, error };
};
