
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BaseBatch } from '@/config/productTypes';
import { toast } from 'sonner';
import { castToUUID } from '@/utils/database/dbHelpers';
import { adaptBatchFromDb } from '@/utils/database/typeAdapters';

export function useBatchDataFetching(productType: string) {
  const [batches, setBatches] = useState<BaseBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Fetching batches for product type: ${productType}`);
      
      // Query batches from Supabase filtered by product type
      const { data: batchData, error: fetchError } = await supabase
        .from('batches')
        .select('*')
        .eq('product_type', productType)
        .order('created_at', { ascending: false });
        
      if (fetchError) {
        console.error("Error fetching batches:", fetchError);
        throw fetchError;
      }
      
      console.log(`Retrieved ${batchData?.length || 0} batches`);
      
      // Process and adapt batch data using our adapter function
      const processedBatches = (batchData || [])
        .map(batch => adaptBatchFromDb<BaseBatch>(batch))
        .filter(Boolean);
      
      setBatches(processedBatches);
    } catch (err) {
      console.error("Error in fetchBatches:", err);
      setError("Failed to load batches");
      toast.error("Error loading batches");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [productType]);

  return {
    batches,
    isLoading,
    error,
    fetchBatches,
  };
}
