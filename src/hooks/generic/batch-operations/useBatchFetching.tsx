
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BaseBatch, ProductConfig } from "@/config/productTypes";
import { toast } from "sonner";
import { getProductTypeCode } from "@/utils/batch/productTypeCodes";
import { castToUUID, processBatchData } from "@/utils/database/dbHelpers";

export function useBatchFetching(config: ProductConfig, batchId: string | null = null) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BaseBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    if (!user) {
      console.log('No authenticated user for batch fetching');
      setIsLoading(false);
      return;
    }

    console.log('Fetching batches for user:', user.id, 'product type:', config.productType);
    
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('batches')
        .select('*')
        .eq('created_by', castToUUID(user.id));
      
      // Get product code from the standardized utility function
      const productCode = getProductTypeCode(config.productType);
      
      if (productCode) {
        // Using the standardized code prefix for batch naming patterns
        console.log(`Using product code ${productCode} for ${config.productType} batches`);
        query = query.or(`name.ilike.%-${productCode}-%,name.ilike.DXB-${productCode}-%`);
      }
      
      if (batchId) {
        query = query.eq("id", castToUUID(batchId));
      }
      
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Batches data received for', config.productType, ':', data?.length || 0, 'records');
      
      // Process the data to ensure type safety
      const processedBatches: BaseBatch[] = [];
      
      if (data && Array.isArray(data)) {
        for (const batch of data) {
          const processed = processBatchData(batch);
          // Only add non-null processed batches
          if (processed) {
            // Set the overview_pdf_url which might be missing in the database
            const genericBatch: BaseBatch = {
              ...processed,
              overview_pdf_url: processed.overview_pdf_url || null,
              // Ensure lamination_type is never undefined
              lamination_type: processed.lamination_type || "none"
            };
            processedBatches.push(genericBatch);
          }
        }
      }
      
      setBatches(processedBatches);
      
      if (batchId && (!data || data.length === 0)) {
        toast.error("Batch not found or you don't have permission to view it.");
      }
    } catch (err) {
      console.error(`Error fetching ${config.productType} batches:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} batches`);
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
  }, [user, batchId]);

  return { batches, isLoading, error, fetchBatches };
}
