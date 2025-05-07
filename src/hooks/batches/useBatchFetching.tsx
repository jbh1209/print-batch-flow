
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BaseBatch, ProductConfig } from "@/config/productTypes";
import { toast } from "sonner";
import { getProductTypeCode } from "@/utils/batch/productTypeCodes";
import { 
  castToUUID, 
  safeDbMap, 
  toSafeString, 
  safeNumber
} from "@/utils/database/dbHelpers";

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
      
      // Use our safe mapping function to convert database results to strongly typed objects
      const genericBatches = safeDbMap(data, batch => {
        return {
          id: toSafeString(batch.id),
          name: toSafeString(batch.name),
          status: toSafeString(batch.status),
          sheets_required: safeNumber(batch.sheets_required, 0),
          front_pdf_url: batch.front_pdf_url ? toSafeString(batch.front_pdf_url) : null,
          back_pdf_url: batch.back_pdf_url ? toSafeString(batch.back_pdf_url) : null,
          overview_pdf_url: null,
          due_date: toSafeString(batch.due_date),
          created_at: toSafeString(batch.created_at),
          created_by: toSafeString(batch.created_by),
          lamination_type: toSafeString(batch.lamination_type || "none"),
          paper_type: batch.paper_type ? toSafeString(batch.paper_type) : undefined,
          paper_weight: batch.paper_weight ? toSafeString(batch.paper_weight) : undefined,
          updated_at: toSafeString(batch.updated_at)
        } as BaseBatch;
      });
      
      setBatches(genericBatches);
      
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
