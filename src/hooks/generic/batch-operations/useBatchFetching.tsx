
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductConfig } from "@/config/productTypes";
import { useAuth } from "@/hooks/useAuth";

export function useBatchFetching(config: ProductConfig, batchId: string | null = null) {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBatches = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!user) {
        console.log("No authenticated user found for batch fetching");
        setIsLoading(false);
        return;
      }
      
      // Build query to get batches of the specific product type
      // No longer filter by created_by to allow all users to see all batches
      let query = supabase
        .from("batches")
        .select("*");
      
      // Add filter to get batches of the correct product type
      // Each product has its own batch name prefix pattern
      const batchNamePrefix = getBatchNamePrefix(config.productType);
      if (batchNamePrefix) {
        query = query.filter('name', 'ilike', batchNamePrefix);
      }
      
      // If looking for a specific batch
      if (batchId) {
        query = query.eq("id", batchId);
      }
      
      // Order by created_at to show newest first
      query = query.order("created_at", { ascending: false });
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        console.error(`Error fetching ${config.productType} batches:`, fetchError);
        throw fetchError;
      }
      
      console.log(`${config.productType} batches received:`, data?.length || 0, "records");
      
      setBatches(data || []);
    } catch (err) {
      console.error(`Error fetching ${config.productType} batches:`, err);
      setError(`Failed to load ${config.productType.toLowerCase()} batches`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [user, batchId]);

  return { batches, isLoading, error, fetchBatches };
}

// Helper to get the correct batch name prefix pattern for each product type
function getBatchNamePrefix(productType: string): string {
  const productTypeCodes: Record<string, string> = {
    'Business Cards': 'DXB-BC-%',
    'Flyers': 'DXB-FL-%',
    'Postcards': 'DXB-PC-%',
    'Boxes': 'DXB-PB-%',
    'Product Boxes': 'DXB-PB-%',
    'Stickers': 'DXB-STK-%',
    'Covers': 'DXB-COV-%',
    'Posters': 'DXB-POS-%',
    'Sleeves': 'DXB-SL-%',
  };
  
  return productTypeCodes[productType] || '%';
}
