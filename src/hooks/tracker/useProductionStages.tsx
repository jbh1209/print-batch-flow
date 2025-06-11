
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
  master_queue_id?: string;
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

      // Transform the data to ensure part_definitions is properly typed as string[]
      const transformedData = (data || []).map(stage => {
        console.log(`🔧 Processing stage "${stage.name}":`, {
          is_multi_part: stage.is_multi_part,
          part_definitions: stage.part_definitions,
          part_definitions_type: typeof stage.part_definitions,
          part_definitions_is_array: Array.isArray(stage.part_definitions),
          master_queue_id: stage.master_queue_id
        });

        let processedPartDefinitions: string[] = [];
        
        if (stage.part_definitions) {
          if (Array.isArray(stage.part_definitions)) {
            processedPartDefinitions = stage.part_definitions.map(item => String(item));
          } else if (typeof stage.part_definitions === 'string') {
            try {
              const parsed = JSON.parse(stage.part_definitions);
              if (Array.isArray(parsed)) {
                processedPartDefinitions = parsed.map(item => String(item));
              }
            } catch {
              processedPartDefinitions = [];
            }
          }
        }

        const transformed = {
          ...stage,
          part_definitions: processedPartDefinitions,
          master_queue_id: stage.master_queue_id || undefined
        };

        console.log(`✅ Transformed stage "${stage.name}":`, transformed);
        return transformed;
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
