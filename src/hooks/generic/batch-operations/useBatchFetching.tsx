
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BaseBatch, ProductConfig } from "@/config/productTypes";
import { toast } from "sonner";
import { getProductTypeCode } from "@/utils/batch/productTypeCodes";

export function useBatchFetching(config: ProductConfig, batchId: string | null = null) {
  const { user, isLoading: authLoading } = useAuth();
  const [batches, setBatches] = useState<BaseBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    // Wait for auth to load before fetching
    if (authLoading) {
      console.log("Auth still loading, waiting...");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('batches')
        .select('*');
      
      // Get product code from the standardized utility function
      const productCode = getProductTypeCode(config.productType);
      
      if (productCode) {
        // Using the standardized code prefix for batch naming patterns
        console.log(`Using product code ${productCode} for ${config.productType} batches`);
        query = query.or(`name.ilike.%-${productCode}-%,name.ilike.DXB-${productCode}-%`);
      }
      
      if (batchId) {
        query = query.eq("id", batchId);
      }
      
      // Remove user filtering to show all batches
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Batches data received for', config.productType, ':', data?.length || 0, 'records');
      
      const genericBatches: BaseBatch[] = (data || []).map(batch => ({
        ...batch,
        overview_pdf_url: null,
        lamination_type: batch.lamination_type || "none"
      }));
      
      setBatches(genericBatches);
      
      if (batchId && (!data || data.length === 0)) {
        toast.error("Batch not found");
      }
    } catch (err) {
      console.error(`Error fetching ${config.productType} batches:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} batches`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch when auth is ready
  useEffect(() => {
    if (!authLoading) {
      fetchBatches();
    }
  }, [authLoading, batchId]);

  return { batches, isLoading, error, fetchBatches };
}
