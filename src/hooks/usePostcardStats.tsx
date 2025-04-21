import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function usePostcardStats() {
  const { user } = useAuth();
  const [pendingJobsCount, setPendingJobsCount] = useState(0);
  const [activeBatchesCount, setActiveBatchesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        // Query postcard_jobs table for pending jobs (specifically for postcards)
        const { count: pendingCount, error: pendingError } = await supabase
          .from('postcard_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'queued');

        if (pendingError) throw pendingError;
        
        // For active batches, only count postcard batches (those with DXB-PC prefix)
        const { data: batchesData, error: batchesError } = await supabase
          .from('batches')
          .select('*')
          .eq('created_by', user.id)
          .in('status', ['pending', 'processing'])
          .ilike('name', 'DXB-PC-%');

        if (batchesError) throw batchesError;

        const postcardBatchesCount = batchesData?.length || 0;

        setPendingJobsCount(pendingCount || 0);
        setActiveBatchesCount(postcardBatchesCount);
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
