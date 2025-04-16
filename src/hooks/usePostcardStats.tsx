
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function usePostcardStats() {
  const { user } = useAuth();
  const [pendingJobsCount, setPendingJobsCount] = useState(0);
  const [activeBatchesCount, setActiveBatchesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        // Query postcard_jobs table for pending jobs
        const { count: pendingCount, error: pendingError } = await supabase
          .from('postcard_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'queued');

        if (pendingError) throw pendingError;
        
        // For active batches, we'll use the batches table with a filter
        const { count: activeCount, error: activeError } = await supabase
          .from('batches')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .in('status', ['pending', 'processing']);

        if (activeError) throw activeError;

        setPendingJobsCount(pendingCount || 0);
        setActiveBatchesCount(activeCount || 0);
      } catch (err) {
        console.error('Error fetching postcard stats:', err);
        setError('Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  return {
    pendingJobsCount,
    activeBatchesCount,
    isLoading,
    error
  };
}
