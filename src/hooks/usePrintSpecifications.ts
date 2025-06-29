
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrintSpecification {
  id: string;
  category: string;
  name: string;
  display_name: string;
  description?: string;
  properties: Record<string, any>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ProductCompatibility {
  id: string;
  product_type: string;
  specification_id: string;
  is_compatible: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const usePrintSpecifications = () => {
  const [specifications, setSpecifications] = useState<PrintSpecification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSpecifications = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('print_specifications')
        .select('*')
        .order('category, sort_order, display_name');

      if (error) throw error;
      setSpecifications(data || []);
    } catch (error) {
      console.error('Error fetching print specifications:', error);
      toast.error('Failed to load print specifications');
    } finally {
      setIsLoading(false);
    }
  };

  const createSpecification = async (spec: Omit<PrintSpecification, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('print_specifications')
        .insert([spec])
        .select()
        .single();

      if (error) throw error;
      
      await fetchSpecifications();
      toast.success('Specification created successfully');
      return data;
    } catch (error) {
      console.error('Error creating specification:', error);
      toast.error('Failed to create specification');
      throw error;
    }
  };

  const updateSpecification = async (id: string, updates: Partial<PrintSpecification>) => {
    try {
      const { error } = await supabase
        .from('print_specifications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      await fetchSpecifications();
      toast.success('Specification updated successfully');
    } catch (error) {
      console.error('Error updating specification:', error);
      toast.error('Failed to update specification');
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
      
      await fetchSpecifications();
      toast.success('Specification deleted successfully');
    } catch (error) {
      console.error('Error deleting specification:', error);
      toast.error('Failed to delete specification');
      throw error;
    }
  };

  const getCompatibleSpecifications = async (productType: string, category: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_compatible_specifications', {
          p_product_type: productType,
          p_category: category
        });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching compatible specifications:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchSpecifications();
  }, []);

  return {
    specifications,
    isLoading,
    createSpecification,
    updateSpecification,
    deleteSpecification,
    getCompatibleSpecifications,
    refetch: fetchSpecifications
  };
};
