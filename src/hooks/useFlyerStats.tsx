
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useFlyerStats() {
  const { user } = useAuth();
  const [pendingJobsCount, setPendingJobsCount] = useState(0);
  const [activeBatchesCount, setActiveBatchesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch pending (queued) jobs count
      const { data: pendingJobs, error: pendingError } = await supabase
        .from('flyer_jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'queued');

      if (pendingError) throw pendingError;

      // Fetch active batches count (pending or processing)
      const { data: activeBatches, error: batchesError } = await supabase
        .from('batches')
        .select('id')
        .eq('created_by', user.id)
        .in('status', ['pending', 'processing'])
        .eq('paper_type', 'Gloss'); // Filter to only show flyer batches (simplified approach)

      if (batchesError) throw batchesError;

      setPendingJobsCount(pendingJobs?.length || 0);
      setActiveBatchesCount(activeBatches?.length || 0);
    } catch (err) {
      console.error('Error fetching flyer statistics:', err);
      setError('Failed to load flyer statistics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return {
    pendingJobsCount,
    activeBatchesCount,
    isLoading,
    error,
    fetchStats
  };
}
