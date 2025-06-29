
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PrintSpecification {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  properties: Record<string, any>;
  is_default?: boolean;
}

export const usePrintSpecifications = () => {
  const [specifications, setSpecifications] = useState<Record<string, PrintSpecification[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const getCompatibleSpecifications = async (productType: string, category: string): Promise<PrintSpecification[]> => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('get_compatible_specifications', {
        p_product_type: productType,
        p_category: category
      });

      if (error) {
        console.error('Error fetching specifications:', error);
        return [];
      }

      const specs = data || [];
      
      // Cache the results
      setSpecifications(prev => ({
        ...prev,
        [`${productType}_${category}`]: specs
      }));

      return specs;
    } catch (error) {
      console.error('Error in getCompatibleSpecifications:', error);
      return [];
    } finally {
      setIsLoading(false);
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
    getCompatibleSpecifications,
    saveJobSpecifications
  };
};
