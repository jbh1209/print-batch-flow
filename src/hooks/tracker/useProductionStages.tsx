
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
  supports_parts: boolean;
  // Enhanced timing fields (optional for backward compatibility)
  running_speed_per_hour?: number;
  make_ready_time_minutes?: number;
  speed_unit?: 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item';
}

export const useProductionStages = () => {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Fetching production stages...');
      
      const { data, error } = await supabase
        .from('production_stages')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;

      console.log('📊 Raw production stages from DB:', data);

      // Transform the data to ensure proper typing and handle new fields
      const transformedData = (data || []).map(stage => {
        console.log(`🔧 Processing stage "${stage.name}":`, stage);
        return {
          ...stage,
          description: stage.description || undefined,
          running_speed_per_hour: stage.running_speed_per_hour || undefined,
          make_ready_time_minutes: stage.make_ready_time_minutes || undefined,
          speed_unit: (stage.speed_unit as 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item') || undefined,
        };
      });

      console.log('🎯 Final transformed stages:', transformedData);
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
