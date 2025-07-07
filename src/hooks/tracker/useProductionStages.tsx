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

      // Transform the data for sequential workflow (no parts)
      const transformedData = (data || []).map(stage => {
        console.log(`🔧 Processing stage "${stage.name}":`, {
          master_queue_id: stage.master_queue_id
        });

        return {
          ...stage,
          is_multi_part: false,
          part_definitions: []
        } as ProductionStage;
      });

      console.log('✅ Production stages transformed:', transformedData.length);
      
      setStages(transformedData);
    } catch (err) {
      console.error('❌ Error fetching production stages:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load production stages';
      setError(errorMessage);
      toast.error('Failed to load production stages');
    } finally {
      setIsLoading(false);
    }
  };

  const createStage = async (stageData: Omit<ProductionStage, 'id'>) => {
    try {
      console.log('🔄 Creating production stage...');
      
      const { error } = await supabase
        .from('production_stages')
        .insert({
          ...stageData,
          is_multi_part: false,
          part_definitions: []
        });

      if (error) {
        console.error('❌ Production stage creation error:', error);
        throw new Error(`Failed to create stage: ${error.message}`);
      }

      console.log('✅ Production stage created successfully');
      toast.success('Production stage created successfully');
      await fetchStages();
      return true;
    } catch (err) {
      console.error('❌ Error creating production stage:', err);
      toast.error('Failed to create production stage');
      return false;
    }
  };

  const updateStage = async (id: string, stageData: Partial<ProductionStage>) => {
    try {
      console.log('🔄 Updating production stage...');
      
      const { error } = await supabase
        .from('production_stages')
        .update({
          ...stageData,
          is_multi_part: false,
          part_definitions: [],
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Production stage update error:', error);
        throw new Error(`Failed to update stage: ${error.message}`);
      }

      console.log('✅ Production stage updated successfully');
      toast.success('Production stage updated successfully');
      await fetchStages();
      return true;
    } catch (err) {
      console.error('❌ Error updating production stage:', err);
      toast.error('Failed to update production stage');
      return false;
    }
  };

  const deleteStage = async (id: string) => {
    try {
      console.log('🔄 Deleting production stage...');
      
      const { error } = await supabase
        .from('production_stages')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        console.error('❌ Production stage deletion error:', error);
        throw new Error(`Failed to delete stage: ${error.message}`);
      }

      console.log('✅ Production stage deleted successfully');
      toast.success('Production stage deleted successfully');
      await fetchStages();
      return true;
    } catch (err) {
      console.error('❌ Error deleting production stage:', err);
      toast.error('Failed to delete production stage');
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