
import { useState } from 'react';
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
  
  // Use React Query for data fetching with proper caching
  const { 
    data: productTypes = [], 
    isLoading,
    isFetching, 
    refetch 
  } = useQuery({
    queryKey: ['productTypes'],
    queryFn: async () => {
      try {
        setError(null);
        const { data, error: fetchError } = await supabase
          .from('product_types')
          .select('*')
          .order('name');
          
        if (fetchError) throw fetchError;
        
        return data || [];
      } catch (err: any) {
        console.error('Error fetching product types:', err);
        setError(err.message || 'Failed to fetch product types');
        toast.error('Failed to load products');
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes before considered stale
    gcTime: 1000 * 60 * 30, // 30 minutes in cache (renamed from cacheTime)
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
  
  // Function for manual refetching - useful for debug buttons or force refresh
  const fetchProductTypes = async () => {
    try {
      await refetch();
    } catch (err: any) {
      console.error('Error refetching product types:', err);
    }
  };

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

  return {
    productTypes,
    isLoading: isLoading || isFetching,
    error,
    fetchProductTypes,
    getProductDetails,
    deleteProduct: deleteProductMutation.mutate
  };
}

export default useProductTypes;
