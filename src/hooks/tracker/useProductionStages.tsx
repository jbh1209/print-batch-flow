
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionStage {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  color: string;
  is_active: boolean;
  is_multi_part: boolean;
  part_definitions: string[];
  created_at: string;
  updated_at: string;
}

export const useProductionStages = () => {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching production stages with updated RLS policies...');

      const { data, error: fetchError } = await supabase
        .from('production_stages')
        .select('*')
        .order('order_index');

      if (fetchError) {
        console.error('❌ Production stages fetch error:', fetchError);
        throw new Error(`Failed to fetch production stages: ${fetchError.message}`);
      }

      console.log('✅ Production stages fetched successfully:', data?.length || 0);
      
      // Transform the data to ensure part_definitions is always an array
      const transformedData = data?.map(stage => ({
        ...stage,
        part_definitions: Array.isArray(stage.part_definitions) 
          ? stage.part_definitions 
          : stage.part_definitions 
            ? (typeof stage.part_definitions === 'string' 
                ? JSON.parse(stage.part_definitions) 
                : [])
            : []
      })) || [];
      
      setStages(transformedData);
    } catch (err) {
      console.error('❌ Error fetching production stages:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load production stages";
      setError(errorMessage);
      toast.error("Failed to load production stages");
    } finally {
      setIsLoading(false);
    }
  };

  const createStage = async (stageData: Omit<ProductionStage, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('🔄 Creating production stage with updated RLS policies...');
      
      const { error } = await supabase
        .from('production_stages')
        .insert({
          ...stageData,
          part_definitions: JSON.stringify(stageData.part_definitions)
        });

      if (error) {
        console.error('❌ Production stage creation error:', error);
        throw new Error(`Failed to create production stage: ${error.message}`);
      }

      console.log('✅ Production stage created successfully');
      toast.success("Production stage created successfully");
      await fetchStages();
      return true;
    } catch (err) {
      console.error('❌ Error creating production stage:', err);
      toast.error("Failed to create production stage");
      return false;
    }
  };

  const updateStage = async (id: string, stageData: Partial<ProductionStage>) => {
    try {
      console.log('🔄 Updating production stage with updated RLS policies...');
      
      const updateData = {
        ...stageData,
        updated_at: new Date().toISOString()
      };

      // Convert part_definitions to JSON string if it's an array
      if (stageData.part_definitions && Array.isArray(stageData.part_definitions)) {
        updateData.part_definitions = JSON.stringify(stageData.part_definitions);
      }

      const { error } = await supabase
        .from('production_stages')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('❌ Production stage update error:', error);
        throw new Error(`Failed to update production stage: ${error.message}`);
      }

      console.log('✅ Production stage updated successfully');
      toast.success("Production stage updated successfully");
      await fetchStages();
      return true;
    } catch (err) {
      console.error('❌ Error updating production stage:', err);
      toast.error("Failed to update production stage");
      return false;
    }
  };

  const deleteStage = async (id: string) => {
    try {
      console.log('🔄 Deleting production stage with updated RLS policies...');
      
      const { error } = await supabase
        .from('production_stages')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Production stage deletion error:', error);
        throw new Error(`Failed to delete production stage: ${error.message}`);
      }

      console.log('✅ Production stage deleted successfully');
      toast.success("Production stage deleted successfully");
      await fetchStages();
      return true;
    } catch (err) {
      console.error('❌ Error deleting production stage:', err);
      toast.error("Failed to delete production stage");
      return false;
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  return {
    stages,
    isLoading,
    error,
    fetchStages,
    createStage,
    updateStage,
    deleteStage
  };
};
