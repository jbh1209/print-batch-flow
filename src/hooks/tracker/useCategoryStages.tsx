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
  production_stage: {
    id: string;
    name: string;
    color: string;
    description?: string;
  };
}

interface CategoryStageInput {
  production_stage_id: string;
  stage_order: number;
  estimated_duration_hours?: number;
  is_required?: boolean;
}

interface DatabaseResponse {
  success: boolean;
  message?: string;
  error?: string;
  fixed_count?: number;
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
            description
          )
        `)
        .eq('category_id', categoryId)
        .order('stage_order');

      if (fetchError) {
        console.error('❌ Category stages fetch error:', fetchError);
        throw new Error(`Failed to fetch category stages: ${fetchError.message}`);
      }

      console.log('✅ Category stages fetched successfully:', data?.length || 0);
      
      // Transform the data to ensure proper types
      const transformedData: CategoryStage[] = data?.map(stage => ({
        ...stage,
        production_stage: {
          ...stage.production_stage
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
      
      const { data, error } = await supabase.rpc('fix_category_stage_ordering', {
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Error fixing stage ordering:', error);
        throw error;
      }

      const result = data as unknown as DatabaseResponse;
      if (result?.success) {
        console.log('✅ Stage ordering fixed successfully:', result.message);
        return true;
      } else {
        console.error('❌ Stage ordering fix failed:', result?.error);
        return false;
      }
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
          ...stageData
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
      
      // Use the safe database function for atomic reordering
      const { data, error } = await supabase.rpc('reorder_category_stages_safe', {
        p_category_id: categoryId,
        p_stage_reorders: reorderedStages
      });

      if (error) {
        console.error('❌ Category stage reorder error:', error);
        throw new Error(`Failed to reorder stages: ${error.message}`);
      }

      const result = data as unknown as DatabaseResponse;
      if (result?.success) {
        console.log('✅ Category stages reordered successfully');
        toast.success("Category stages reordered successfully");
        await fetchCategoryStages();
        return true;
      } else {
        console.error('❌ Category stage reorder failed:', result?.error);
        toast.error(result?.error || "Failed to reorder category stages");
        return false;
      }
    } catch (err) {
      console.error('❌ Error reordering category stages:', err);
      toast.error("Failed to reorder category stages");
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
