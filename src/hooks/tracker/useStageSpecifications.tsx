import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StageSpecification {
  id: string;
  production_stage_id: string;
  name: string;
  description?: string | null;
  running_speed_per_hour?: number | null;
  make_ready_time_minutes?: number | null;
  speed_unit?: 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item' | null;
  properties?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useStageSpecifications = (stageId?: string) => {
  const [specifications, setSpecifications] = useState<StageSpecification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpecifications = useCallback(async () => {
    if (!stageId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching stage specifications...');

      const { data, error: fetchError } = await supabase
        .from('stage_specifications')
        .select('*')
        .eq('production_stage_id', stageId)
        .eq('is_active', true)
        .order('name');

      if (fetchError) {
        console.error('❌ Stage specifications fetch error:', fetchError);
        throw new Error(`Failed to fetch stage specifications: ${fetchError.message}`);
      }

      console.log('✅ Stage specifications fetched successfully:', data?.length || 0);
      
      // Type-safe mapping
      const typedData: StageSpecification[] = (data || []).map(item => ({
        ...item,
        description: item.description || null,
        running_speed_per_hour: item.running_speed_per_hour || null,
        make_ready_time_minutes: item.make_ready_time_minutes || null,
        speed_unit: (item.speed_unit as 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item') || null,
        properties: item.properties || {},
      }));
      
      setSpecifications(typedData);
    } catch (err) {
      console.error('❌ Error fetching stage specifications:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load stage specifications";
      setError(errorMessage);
      toast.error("Failed to load stage specifications");
    } finally {
      setIsLoading(false);
    }
  }, [stageId]);

  const createSpecification = useCallback(async (spec: Omit<StageSpecification, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('🔄 Creating stage specification...');
      
      const { data, error } = await supabase
        .from('stage_specifications')
        .insert([spec])
        .select()
        .single();

      if (error) {
        console.error('❌ Stage specification creation error:', error);
        throw new Error(`Failed to create stage specification: ${error.message}`);
      }

      console.log('✅ Stage specification created successfully');
      toast.success("Stage specification created successfully");
      await fetchSpecifications();
      return data;
    } catch (err) {
      console.error('❌ Error creating stage specification:', err);
      toast.error("Failed to create stage specification");
      return null;
    }
  }, [fetchSpecifications]);

  const updateSpecification = useCallback(async (specId: string, updates: Partial<StageSpecification>) => {
    try {
      console.log('🔄 Updating stage specification...');
      
      const { error } = await supabase
        .from('stage_specifications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', specId);

      if (error) {
        console.error('❌ Stage specification update error:', error);
        throw new Error(`Failed to update stage specification: ${error.message}`);
      }

      console.log('✅ Stage specification updated successfully');
      toast.success("Stage specification updated successfully");
      await fetchSpecifications();
      return true;
    } catch (err) {
      console.error('❌ Error updating stage specification:', err);
      toast.error("Failed to update stage specification");
      return false;
    }
  }, [fetchSpecifications]);

  const deleteSpecification = useCallback(async (specId: string) => {
    try {
      console.log('🔄 Deleting stage specification...');
      
      const { error } = await supabase
        .from('stage_specifications')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', specId);

      if (error) {
        console.error('❌ Stage specification deletion error:', error);
        throw new Error(`Failed to delete stage specification: ${error.message}`);
      }

      console.log('✅ Stage specification deleted successfully');
      toast.success("Stage specification deleted successfully");
      await fetchSpecifications();
      return true;
    } catch (err) {
      console.error('❌ Error deleting stage specification:', err);
      toast.error("Failed to delete stage specification");
      return false;
    }
  }, [fetchSpecifications]);

  useEffect(() => {
    if (stageId) {
      fetchSpecifications();
    }
  }, [stageId, fetchSpecifications]);

  return {
    specifications,
    isLoading,
    error,
    fetchSpecifications,
    createSpecification,
    updateSpecification,
    deleteSpecification
  };
};