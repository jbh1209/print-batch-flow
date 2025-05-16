
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProductTypes();
  }, []);

  const fetchProductTypes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('product_types')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      setProductTypes(data || []);
    } catch (err: any) {
      console.error('Error fetching product types:', err);
      setError(err.message || 'Failed to fetch product types');
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

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
    isLoading,
    error,
    fetchProductTypes,
    getProductDetails
  };
}

export default useProductTypes;
