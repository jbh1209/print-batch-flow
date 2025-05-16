
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ProductType = {
  id: string;
  name: string;
  slug: string;
  table_name: string;
  job_prefix: string;
  icon_name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type ProductField = {
  id: string;
  product_type_id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
};

export type ProductFieldOption = {
  id: string;
  product_field_id: string;
  option_value: string;
  display_name: string;
};

export function useProductTypes() {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Function to fetch product types - extracted for reuse
  const fetchProductTypesFromDb = async () => {
    try {
      console.log("Fetching product types from database");
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('product_types')
        .select('*')
        .order('name');
        
      if (fetchError) throw fetchError;
      
      console.log(`Fetched ${data?.length || 0} product types`);
      return data || [];
    } catch (err: any) {
      console.error('Error fetching product types:', err);
      setError(err.message || 'Failed to fetch product types');
      toast.error('Failed to load products');
      return [];
    }
  };
  
  // Use React Query for data fetching with proper caching
  const { 
    data: productTypes = [], 
    isLoading,
    isFetching, 
    refetch 
  } = useQuery({
    queryKey: ['productTypes'],
    queryFn: fetchProductTypesFromDb,
    staleTime: 1000 * 60 * 5, // 5 minutes before considered stale
    gcTime: 1000 * 60 * 30, // 30 minutes in cache (renamed from cacheTime)
    refetchOnWindowFocus: false, // Don't fetch on window focus
    refetchOnReconnect: true, // Refetch on reconnect to network
    retry: 1, // Only retry once
  });

  // Mutation for product deletion
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('product_types')
        .delete()
        .eq('id', productId);
        
      if (error) throw error;
      return productId;
    },
    onSuccess: () => {
      // Invalidate cache and refetch
      queryClient.invalidateQueries({ queryKey: ['productTypes'] });
      toast.success('Product deleted successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to delete product: ${err.message}`);
    }
  });
  
  // Function for manual refetching with robust error handling
  const fetchProductTypes = useCallback(async () => {
    try {
      console.log("Manually refreshing product types");
      await refetch();
    } catch (err: any) {
      console.error('Error refetching product types:', err);
      setError(err.message || 'Failed to refresh product types');
      toast.error('Failed to refresh products');
    }
  }, [refetch]);

  // Force clear cache and refetch - useful for debugging
  const forceClearCache = useCallback(() => {
    console.log("Forcing clear of product types cache");
    queryClient.removeQueries({ queryKey: ['productTypes'] });
    toast.info('Product types cache cleared');
    fetchProductTypes();
  }, [queryClient, fetchProductTypes]);

  // Get details for a single product
  const getProductDetails = async (productId: string) => {
    try {
      // First get the product type
      const { data: product, error: productError } = await supabase
        .from('product_types')
        .select('*')
        .eq('id', productId)
        .single();
        
      if (productError) throw productError;
      
      // Get fields for this product
      const { data: fields, error: fieldsError } = await supabase
        .from('product_fields')
        .select('*')
        .eq('product_type_id', productId);
        
      if (fieldsError) throw fieldsError;
      
      // Get options for select fields
      const fieldsWithOptions = await Promise.all(
        (fields || []).map(async (field) => {
          if (field.field_type === 'select') {
            // Fetch options
            const { data: options, error: optionsError } = await supabase
              .from('product_field_options')
              .select('*')
              .eq('product_field_id', field.id);
              
            if (optionsError) throw optionsError;
            
            return {
              ...field,
              options: options || []
            };
          }
          
          return {
            ...field,
            options: []
          };
        })
      );
      
      return {
        product,
        fields: fieldsWithOptions
      };
      
    } catch (err: any) {
      console.error('Error fetching product details:', err);
      throw new Error(err.message || 'Failed to fetch product details');
    }
  };

  // Get the current cache status using API available in the current version
  const getCacheStatus = () => {
    const queryState = queryClient.getQueryState(['productTypes']);
    return {
      isFetching,
      isStale: queryClient.getQueryState(['productTypes'])?.fetchStatus === 'idle' && 
              queryClient.getQueryState(['productTypes'])?.dataUpdateCount !== undefined && 
              queryClient.getQueryState(['productTypes'])?.dataUpdateCount > 0,
      dataUpdatedAt: queryState?.dataUpdatedAt || 0
    };
  };

  return {
    productTypes,
    isLoading: isLoading || isFetching,
    error,
    fetchProductTypes,
    forceClearCache,
    getProductDetails,
    deleteProduct: deleteProductMutation.mutate,
    cacheInfo: getCacheStatus()
  };
}

export default useProductTypes;
