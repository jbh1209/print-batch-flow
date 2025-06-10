
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  order_index: number;
  is_active: boolean;
  is_multi_part: boolean;
  part_definitions: string[]; // Keep as required and properly typed
}

export const useProductionStages = () => {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('production_stages')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;

      // Transform the data to ensure part_definitions is properly typed as string[]
      const transformedData = (data || []).map(stage => ({
        ...stage,
        part_definitions: Array.isArray(stage.part_definitions) 
          ? stage.part_definitions.map(item => String(item))
          : []
      }));

      setStages(transformedData);
    } catch (err) {
      console.error('Error fetching production stages:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load production stages";
      setError(errorMessage);
      toast.error("Failed to load production stages");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStage = async (stageId: string, updates: Partial<ProductionStage>) => {
    try {
      const { error } = await supabase
        .from('production_stages')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', stageId);

      if (error) throw error;

      // Update local state
      setStages(prevStages => 
        prevStages.map(stage => 
          stage.id === stageId ? { ...stage, ...updates } : stage
        )
      );

      toast.success('Production stage updated successfully');
    } catch (err) {
      console.error('Error updating production stage:', err);
      toast.error("Failed to update production stage");
    }
  };

  const deleteStage = async (stageId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('production_stages')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', stageId);

      if (error) throw error;

      // Remove from local state
      setStages(prevStages => prevStages.filter(stage => stage.id !== stageId));

      toast.success('Production stage deleted successfully');
      return true;
    } catch (err) {
      console.error('Error deleting production stage:', err);
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
    refreshStages: fetchStages,
    updateStage,
    deleteStage
  };
};
