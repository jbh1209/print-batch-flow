
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PrintSpecification {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category: string;
  properties: Record<string, any>;
  is_active: boolean;
  sort_order: number;
  is_default?: boolean;
}

export const usePrintSpecifications = () => {
  const [specifications, setSpecifications] = useState<PrintSpecification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAllSpecifications = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('print_specifications')
        .select('*')
        .eq('is_active', true)
        .order('category, sort_order, display_name');

      if (error) {
        console.error('Error fetching specifications:', error);
        return;
      }

      const specs = (data || []).map(spec => ({
        ...spec,
        properties: typeof spec.properties === 'string' ? JSON.parse(spec.properties) : spec.properties || {}
      }));
      
      setSpecifications(specs);
    } catch (error) {
      console.error('Error in loadAllSpecifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllSpecifications();
  }, []);

  const getAvailableCategories = async (productType: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('print_specifications')
        .select('category')
        .eq('is_active', true)
        .neq('name', '_category');

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      // Get unique categories
      const categories = [...new Set(data.map(spec => spec.category))];
      return categories.filter(Boolean);
    } catch (error) {
      console.error('Error in getAvailableCategories:', error);
      return [];
    }
  };

  const getCompatibleSpecifications = async (productType: string, category: string): Promise<PrintSpecification[]> => {
    try {
      const { data, error } = await supabase.rpc('get_compatible_specifications', {
        p_product_type: productType,
        p_category: category
      });

      if (error) {
        console.error('Error fetching specifications:', error);
        return [];
      }

      return (data || []).map((spec: any) => ({
        ...spec,
        properties: typeof spec.properties === 'string' ? JSON.parse(spec.properties) : spec.properties || {}
      }));
    } catch (error) {
      console.error('Error in getCompatibleSpecifications:', error);
      return [];
    }
  };

  const createSpecification = async (specData: Omit<PrintSpecification, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('print_specifications')
        .insert([{
          ...specData,
          properties: JSON.stringify(specData.properties)
        }])
        .select()
        .single();

      if (error) throw error;

      await loadAllSpecifications();
      return data;
    } catch (error) {
      console.error('Error creating specification:', error);
      throw error;
    }
  };

  const updateSpecification = async (id: string, specData: Partial<PrintSpecification>) => {
    try {
      const updateData = {
        ...specData,
        properties: specData.properties ? JSON.stringify(specData.properties) : undefined
      };

      const { data, error } = await supabase
        .from('print_specifications')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await loadAllSpecifications();
      return data;
    } catch (error) {
      console.error('Error updating specification:', error);
      throw error;
    }
  };

  const deleteSpecification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('print_specifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadAllSpecifications();
    } catch (error) {
      console.error('Error deleting specification:', error);
      throw error;
    }
  };

  const saveJobSpecifications = async (
    jobId: string,
    jobTableName: string,
    specifications: Record<string, string>
  ) => {
    try {
      // First, clear existing specifications for this job
      const { error: deleteError } = await supabase
        .from('job_print_specifications')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (deleteError) throw deleteError;

      // Insert new specifications
      const specsToInsert = Object.entries(specifications).map(([category, specId]) => ({
        job_id: jobId,
        job_table_name: jobTableName,
        specification_category: category,
        specification_id: specId
      }));

      if (specsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('job_print_specifications')
          .insert(specsToInsert);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error saving job specifications:', error);
      return false;
    }
  };

  return {
    specifications,
    isLoading,
    getAvailableCategories,
    getCompatibleSpecifications,
    saveJobSpecifications,
    createSpecification,
    updateSpecification,
    deleteSpecification
  };
};
