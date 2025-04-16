
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

        // Since postcard_jobs and postcard_batches tables don't exist yet,
        // we'll use the batches table with appropriate filters
        
        // For pending jobs, we'll use a placeholder value
        // In a real implementation, this would query the postcard_jobs table
        setPendingJobsCount(0);
        
        // For active batches, we'll use the batches table with a filter
        // Assuming batches have a type field or similar to distinguish between products
        const { count: activeCount, error: activeError } = await supabase
          .from('batches')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .in('status', ['pending', 'processing']);

        if (activeError) throw activeError;

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
