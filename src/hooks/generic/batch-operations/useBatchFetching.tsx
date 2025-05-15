
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BaseBatch, ProductConfig } from "@/config/productTypes";
import { toast } from "sonner";
import { getProductTypeCode, extractProductCodeFromBatchName } from "@/utils/batch/productTypeCodes";

interface BatchFetchingOptions {
  filterByCurrentUser?: boolean;
}

export function useBatchFetching(
  config: ProductConfig, 
  batchId: string | null = null,
  options: BatchFetchingOptions = { filterByCurrentUser: false }
) {
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

    console.log('Fetching batches for product type:', config.productType, 'filterByCurrentUser:', options.filterByCurrentUser);
    
    setIsLoading(true);
    setError(null);

    try {
      // Start building the query
      let query = supabase
        .from('batches')
        .select('*');
      
      // Only filter by user ID if explicitly requested
      if (options.filterByCurrentUser) {
        query = query.eq('created_by', user.id);
        console.log('Filtering batches by current user:', user.id);
      }
      
      // Get product code from the standardized utility function
      const productCode = getProductTypeCode(config.productType);
      
      if (productCode && !batchId) {
        console.log(`Using product code ${productCode} for ${config.productType} batches`);
        
        // Use proper Supabase filter syntax for OR conditions
        query = query.or([
          `name.ilike.%DXB-${productCode}-%`, 
          `name.ilike.%-${productCode}-%`, 
          `name.ilike.%${productCode}%`
        ].join(','));
        
        console.log(`Using filter: "${[
          `name.ilike.%DXB-${productCode}-%`, 
          `name.ilike.%-${productCode}-%`, 
          `name.ilike.%${productCode}%`
        ].join(',')}"`);
      } else if (batchId) {
        query = query.eq("id", batchId);
        console.log(`Fetching specific batch by ID: ${batchId}`);
      } else {
        console.warn(`No product code found for ${config.productType} - fetching all batches`);
      }
      
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Batches data received for', config.productType, ':', data?.length || 0, 'records');
      if (data && data.length > 0) {
        console.log('Sample batch names:', data.slice(0, 3).map(b => b.name).join(', '));
      } else {
        console.warn(`No batches found for ${config.productType} with code ${productCode}`);
        
        // If no batches found with specific code, let's fetch all batches and filter here in code
        // for development/debugging purposes
        if (process.env.NODE_ENV === 'development') {
          console.log('Development mode: Attempting broader fetch to debug batch issue');
          
          const { data: allData } = await supabase
            .from('batches')
            .select('*')
            .order('created_at', { ascending: false });
            
          if (allData && allData.length > 0) {
            console.log('All batches:', allData.length);
            console.log('All batch names:', allData.map(b => b.name).join(', '));
            
            // Improved fallback filtering logic
            const filteredBatches = allData.filter(batch => {
              if (!batch.name) return false;
              
              // More robust pattern matching for batch names
              const batchNameLower = batch.name.toLowerCase();
              const productTypeLower = config.productType.toLowerCase();
              const codeMatches = extractProductCodeFromBatchName(batch.name) === productCode;
              const nameContainsProductType = batchNameLower.includes(productTypeLower);
              const nameContainsCode = batchNameLower.includes(productCode?.toLowerCase() || '');
              
              const matched = codeMatches || nameContainsProductType || nameContainsCode;
              console.log(`Batch ${batch.name}: matched=${matched} (code match: ${codeMatches}, name match: ${nameContainsProductType}, code in name: ${nameContainsCode})`);
              return matched;
            });
            
            if (filteredBatches.length > 0) {
              console.log('Manually filtered batches found:', filteredBatches.length);
              console.log('Manual filtered batch names:', filteredBatches.map(b => b.name).join(', '));
              setBatches(filteredBatches.map(batch => ({
                ...batch,
                overview_pdf_url: batch.overview_pdf_url || null,
                lamination_type: batch.lamination_type || "none"
              })));
              setIsLoading(false);
              return;
            } else {
              console.warn('No batches found after manual filtering - this is likely an issue with batch naming patterns or product types');
            }
          }
        }
      }
      
      // Convert database records to BaseBatch objects with required properties
      const genericBatches: BaseBatch[] = (data || []).map(batch => ({
        ...batch,
        // Ensure overview_pdf_url is always defined, even if it's null
        overview_pdf_url: batch.overview_pdf_url || null,
        lamination_type: batch.lamination_type || "none"
      }));
      
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
