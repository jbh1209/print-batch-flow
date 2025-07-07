import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CategoryStage {
  id: string;
  category_id: string;
  production_stage_id: string;
  stage_order: number;
  estimated_duration_hours: number;
  is_required: boolean;
  applies_to_parts: string[];
  part_rule_type: 'all_parts' | 'specific_parts' | 'exclude_parts';
  production_stage: {
    id: string;
    name: string;
    color: string;
    description?: string;
    is_multi_part: boolean;
    part_definitions: string[];
  };
}

interface CategoryStageInput {
  production_stage_id: string;
  stage_order: number;
  estimated_duration_hours?: number;
  is_required?: boolean;
  applies_to_parts?: string[];
  part_rule_type?: 'all_parts' | 'specific_parts' | 'exclude_parts';
}

export const useCategoryStages = (categoryId?: string) => {
  const [categoryStages, setCategoryStages] = useState<CategoryStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategoryStages = async () => {
    if (!categoryId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching category stages...');

      const { data, error: fetchError } = await supabase
        .from('category_production_stages')
        .select(`
          *,
          production_stage:production_stages(
            id,
            name,
            color,
            description,
            is_multi_part,
            part_definitions
          )
        `)
        .eq('category_id', categoryId)
        .order('stage_order');

      if (fetchError) {
        console.error('❌ Category stages fetch error:', fetchError);
        throw new Error(`Failed to fetch category stages: ${fetchError.message}`);
      }

      console.log('✅ Category stages fetched successfully:', data?.length || 0);
      
      // Transform the data for sequential workflow (no parts)
      const transformedData: CategoryStage[] = data?.map(stage => ({
        ...stage,
        applies_to_parts: [],
        part_rule_type: 'all_parts' as const,
        production_stage: stage.production_stage && typeof stage.production_stage === 'object' ? {
          ...stage.production_stage,
          part_definitions: []
        } : {
          id: '',
          name: '',
          description: '',
          color: '#6B7280',
          part_definitions: []
        }
      })) || [];
      
      setCategoryStages(transformedData);
    } catch (err) {
      console.error('❌ Error fetching category stages:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load category stages";
      setError(errorMessage);
      toast.error("Failed to load category stages");
    } finally {
      setIsLoading(false);
    }
  };

  const fixStageOrdering = async (categoryId: string) => {
    try {
      console.log('🔄 Fixing stage ordering for category...');
      
      // Get all stages for this category, sorted by current order
      const { data: stages, error: fetchError } = await supabase
        .from('category_production_stages')
        .select('id, stage_order')
        .eq('category_id', categoryId)
        .order('stage_order');

      if (fetchError) throw fetchError;
      if (!stages || stages.length === 0) return true;

      // Update each stage to have sequential order (1, 2, 3, ...)
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const correctOrder = i + 1;
        
        if (stage.stage_order !== correctOrder) {
          const { error: updateError } = await supabase
            .from('category_production_stages')
            .update({ 
              stage_order: correctOrder,
              updated_at: new Date().toISOString() 
            })
            .eq('id', stage.id);

          if (updateError) {
            console.error('❌ Error fixing stage order:', updateError);
            throw updateError;
          }
        }
      }

      console.log('✅ Stage ordering fixed successfully');
      return true;
    } catch (err) {
      console.error('❌ Error fixing stage ordering:', err);
      return false;
    }
  };

  const addStageToCategory = async (categoryId: string, stageData: CategoryStageInput) => {
    try {
      console.log('🔄 Adding stage to category...');
      
      const { error } = await supabase
        .from('category_production_stages')
        .insert({
          category_id: categoryId,
          ...stageData,
          applies_to_parts: JSON.stringify(stageData.applies_to_parts || []),
          part_rule_type: stageData.part_rule_type || 'all_parts'
        });

      if (error) {
        console.error('❌ Category stage creation error:', error);
        throw new Error(`Failed to add stage to category: ${error.message}`);
      }

      console.log('✅ Stage added to category successfully');
      toast.success("Stage added to category successfully");
      await fetchCategoryStages();
      return true;
    } catch (err) {
      console.error('❌ Error adding stage to category:', err);
      toast.error("Failed to add stage to category");
      return false;
    }
  };

  const updateCategoryStage = async (id: string, stageData: Partial<CategoryStageInput>) => {
    try {
      console.log('🔄 Updating category stage...');
      
      const updateData: any = { 
        ...stageData, 
        updated_at: new Date().toISOString() 
      };
      
      // Handle part-specific fields
      if (stageData.applies_to_parts !== undefined) {
        updateData.applies_to_parts = JSON.stringify(stageData.applies_to_parts);
      }
      
      const { error } = await supabase
        .from('category_production_stages')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('❌ Category stage update error:', error);
        throw new Error(`Failed to update category stage: ${error.message}`);
      }

      console.log('✅ Category stage updated successfully');
      toast.success("Category stage updated successfully");
      await fetchCategoryStages();
      return true;
    } catch (err) {
      console.error('❌ Error updating category stage:', err);
      toast.error("Failed to update category stage");
      return false;
    }
  };

  const removeCategoryStage = async (id: string) => {
    try {
      console.log('🔄 Removing category stage...');
      
      // Get the stage being deleted to know its order
      const stageToDelete = categoryStages.find(stage => stage.id === id);
      if (!stageToDelete) {
        throw new Error('Stage not found');
      }

      // Delete the stage first
      const { error: deleteError } = await supabase
        .from('category_production_stages')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('❌ Category stage deletion error:', deleteError);
        throw new Error(`Failed to remove category stage: ${deleteError.message}`);
      }

      // Fix the ordering for the entire category to ensure sequential order
      await fixStageOrdering(stageToDelete.category_id);

      console.log('✅ Category stage removed successfully');
      toast.success("Category stage removed successfully");
      await fetchCategoryStages();
      return true;
    } catch (err) {
      console.error('❌ Error removing category stage:', err);
      toast.error("Failed to remove category stage");
      return false;
    }
  };

  const reorderCategoryStages = async (categoryId: string, reorderedStages: { id: string; stage_order: number }[]) => {
    try {
      console.log('🔄 Reordering category stages...');
      
      // Get all current stages with their production stage info for validation
      const { data: allStages, error: fetchError } = await supabase
        .from('category_production_stages')
        .select(`
          id, 
          stage_order,
          production_stage:production_stages(id, name)
        `)
        .eq('category_id', categoryId)
        .order('stage_order');

      if (fetchError) {
        console.error('❌ Failed to fetch current stages:', fetchError);
        throw new Error('Failed to fetch current category stages');
      }

      if (!allStages || allStages.length === 0) {
        throw new Error('No stages found for category');
      }

      // Create a mapping for the new orders
      const stageOrderMap = new Map(reorderedStages.map(stage => [stage.id, stage.stage_order]));
      
      // Validate business rules: Batch Allocation must be first
      const batchAllocationStage = allStages.find(stage => 
        stage.production_stage?.name === 'Batch Allocation'
      );
      
      if (batchAllocationStage) {
        const newBatchOrder = stageOrderMap.get(batchAllocationStage.id);
        if (newBatchOrder && newBatchOrder !== 1) {
          throw new Error('Batch Allocation stage must be first in the workflow');
        }
      }

      // Manual reordering with proper constraint handling and business rule validation
      console.log('🔄 Performing manual reordering with validation...');
      
      // Use a randomized high temporary offset to avoid unique constraint violations
      const TEMP_OFFSET = 50000 + Math.floor(Math.random() * 10000);
      
      // Phase 1: Move all stages to temporary high values
      const tempUpdates = allStages.map((stage, index) => 
        supabase
          .from('category_production_stages')
          .update({ 
            stage_order: TEMP_OFFSET + index,
            updated_at: new Date().toISOString() 
          })
          .eq('id', stage.id)
      );

      const tempResults = await Promise.all(tempUpdates);
      const tempErrors = tempResults.filter(result => result.error);
      if (tempErrors.length > 0) {
        console.error('❌ Temp stage updates failed:', tempErrors);
        throw new Error('Failed to prepare stages for reordering');
      }

      // Phase 2: Set final order values with proper validation
      const finalUpdates = allStages.map(stage => {
        const newOrder = stageOrderMap.get(stage.id) ?? stage.stage_order;
        return supabase
          .from('category_production_stages')
          .update({ 
            stage_order: newOrder,
            updated_at: new Date().toISOString() 
          })
          .eq('id', stage.id);
      });

      const finalResults = await Promise.all(finalUpdates);
      const finalErrors = finalResults.filter(result => result.error);
      if (finalErrors.length > 0) {
        console.error('❌ Final stage updates failed:', finalErrors);
        throw new Error('Failed to complete stage reordering');
      }

      console.log('✅ Category stages reordered successfully');
      toast.success("Category stages reordered successfully");
      await fetchCategoryStages();
      return true;
    } catch (err) {
      console.error('❌ Error reordering category stages:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to reorder category stages";
      toast.error(errorMessage);
      return false;
    }
  };

  useEffect(() => {
    fetchCategoryStages();
  }, [categoryId]);

  return {
    categoryStages,
    isLoading,
    error,
    fetchCategoryStages,
    addStageToCategory,
    updateCategoryStage,
    removeCategoryStage,
    reorderCategoryStages,
    fixStageOrdering
  };
};
