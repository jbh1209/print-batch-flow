
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerBatch } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';

export function useFlyerBatches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<FlyerBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use the "batches" table but filter by created_by
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert to FlyerBatch type
      const flyerBatches: FlyerBatch[] = data || [];
      setBatches(flyerBatches);
    } catch (err) {
      console.error('Error fetching flyer batches:', err);
      setError('Failed to load flyer batches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [user]);
  
  const handleViewPDF = (url: string | null) => {
    if (!url) {
      toast.error('No PDF available to view');
      return;
    }
    
    window.open(url, '_blank');
  };
  
  return {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF
  };
}
