import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PaperSpecification {
  id: string;
  name: string;
  display_name: string;
  category: string;
  sort_order: number;
}

export interface CurrentPaperSpecs {
  paper_type_id: string | null;
  paper_type_name: string | null;
  paper_weight_id: string | null;
  paper_weight_name: string | null;
}

export const useJobPaperSpecEditor = (jobId: string, jobTableName: string = 'production_jobs') => {
  const [paperTypes, setPaperTypes] = useState<PaperSpecification[]>([]);
  const [paperWeights, setPaperWeights] = useState<PaperSpecification[]>([]);
  const [currentSpecs, setCurrentSpecs] = useState<CurrentPaperSpecs>({
    paper_type_id: null,
    paper_type_name: null,
    paper_weight_id: null,
    paper_weight_name: null
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load available paper types
  const loadPaperTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('print_specifications')
        .select('id, name, display_name, category, sort_order')
        .eq('category', 'paper_type')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPaperTypes(data || []);
    } catch (error) {
      console.error('Error loading paper types:', error);
    }
  }, []);

  // Load available paper weights
  const loadPaperWeights = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('print_specifications')
        .select('id, name, display_name, category, sort_order')
        .eq('category', 'paper_weight')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPaperWeights(data || []);
    } catch (error) {
      console.error('Error loading paper weights:', error);
    }
  }, []);

  // Load current job paper specifications
  const loadCurrentSpecs = useCallback(async () => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_print_specifications')
        .select(`
          specification_category,
          specification_id,
          print_specifications!inner(
            id,
            name,
            display_name,
            category
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .in('specification_category', ['paper_type', 'paper_weight']);

      if (error) throw error;

      const specs: CurrentPaperSpecs = {
        paper_type_id: null,
        paper_type_name: null,
        paper_weight_id: null,
        paper_weight_name: null
      };

      data?.forEach((item: any) => {
        if (item.specification_category === 'paper_type') {
          specs.paper_type_id = item.specification_id;
          specs.paper_type_name = item.print_specifications.display_name;
        } else if (item.specification_category === 'paper_weight') {
          specs.paper_weight_id = item.specification_id;
          specs.paper_weight_name = item.print_specifications.display_name;
        }
      });

      setCurrentSpecs(specs);
    } catch (error) {
      console.error('Error loading current paper specs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, jobTableName]);

  // Update paper specification
  const updatePaperSpecification = useCallback(async (
    category: 'paper_type' | 'paper_weight',
    specificationId: string
  ) => {
    try {
      // Delete existing spec for this category
      const { error: deleteError } = await supabase
        .from('job_print_specifications')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .eq('specification_category', category);

      if (deleteError) throw deleteError;

      // Insert new spec
      const { error: insertError } = await supabase
        .from('job_print_specifications')
        .insert({
          job_id: jobId,
          job_table_name: jobTableName,
          specification_category: category,
          specification_id: specificationId
        });

      if (insertError) throw insertError;

      // Update local state
      const specList = category === 'paper_type' ? paperTypes : paperWeights;
      const spec = specList.find(s => s.id === specificationId);
      
      setCurrentSpecs(prev => ({
        ...prev,
        [`${category}_id`]: specificationId,
        [`${category}_name`]: spec?.display_name || null
      }));

      toast.success(`Paper ${category.replace('_', ' ')} updated successfully`);
      return true;
    } catch (error) {
      console.error(`Error updating ${category}:`, error);
      toast.error(`Failed to update paper ${category.replace('_', ' ')}`);
      return false;
    }
  }, [jobId, jobTableName, paperTypes, paperWeights]);

  // Load data on mount
  useEffect(() => {
    loadPaperTypes();
    loadPaperWeights();
    loadCurrentSpecs();
  }, [loadPaperTypes, loadPaperWeights, loadCurrentSpecs]);

  return {
    paperTypes,
    paperWeights,
    currentSpecs,
    isLoading,
    updatePaperSpecification,
    refreshSpecs: loadCurrentSpecs
  };
};
