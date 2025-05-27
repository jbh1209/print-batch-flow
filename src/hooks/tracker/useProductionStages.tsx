
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

      const { data, error: fetchError } = await supabase
        .from('production_stages')
        .select('*')
        .order('order_index');

      if (fetchError) {
        throw new Error(`Failed to fetch production stages: ${fetchError.message}`);
      }

      setStages(data || []);
    } catch (err) {
      console.error('Error fetching production stages:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load production stages";
      setError(errorMessage);
      toast.error("Failed to load production stages");
    } finally {
      setIsLoading(false);
    }
  };

  const createStage = async (stageData: Omit<ProductionStage, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('production_stages')
        .insert(stageData);

      if (error) {
        throw new Error(`Failed to create production stage: ${error.message}`);
      }

      toast.success("Production stage created successfully");
      await fetchStages();
      return true;
    } catch (err) {
      console.error('Error creating production stage:', err);
      toast.error("Failed to create production stage");
      return false;
    }
  };

  const updateStage = async (id: string, stageData: Partial<ProductionStage>) => {
    try {
      const { error } = await supabase
        .from('production_stages')
        .update({ ...stageData, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to update production stage: ${error.message}`);
      }

      toast.success("Production stage updated successfully");
      await fetchStages();
      return true;
    } catch (err) {
      console.error('Error updating production stage:', err);
      toast.error("Failed to update production stage");
      return false;
    }
  };

  const deleteStage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('production_stages')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete production stage: ${error.message}`);
      }

      toast.success("Production stage deleted successfully");
      await fetchStages();
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
    fetchStages,
    createStage,
    updateStage,
    deleteStage
  };
};
