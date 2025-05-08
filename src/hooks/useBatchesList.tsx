import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { processBatchData } from "@/utils/database/dbHelpers";

export function useBatchesList() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBatches = async () => {
    if (!user) {
      console.log('No authenticated user for batch fetching');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Batches data received:', data?.length || 0, 'records');
      
      // Process the data safely to avoid error types
      const processedBatches = [];
      if (data && Array.isArray(data)) {
        for (const batch of data) {
          const processedBatch = processBatchData(batch);
          if (processedBatch) {
            processedBatches.push(processedBatch);
          }
        }
        setBatches(processedBatches);
      } else {
        setBatches([]);
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
      setError('Failed to load batches');
      toast.error('Error loading batches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBatches();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  return { batches, isLoading, error, fetchBatches };
}
