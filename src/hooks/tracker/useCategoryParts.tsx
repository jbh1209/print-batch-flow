
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CategoryPartInfo {
  availableParts: string[];
  multiPartStages: Array<{
    stage_id: string;
    stage_name: string;
    stage_color: string;
    part_types: string[];
  }>;
  hasMultiPartStages: boolean;
}

export const useCategoryParts = (categoryId: string | null) => {
  const [categoryParts, setCategoryParts] = useState<CategoryPartInfo>({
    availableParts: [],
    multiPartStages: [],
    hasMultiPartStages: false
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setCategoryParts({
        availableParts: [],
        multiPartStages: [],
        hasMultiPartStages: false
      });
      return;
    }

    const loadCategoryParts = async () => {
      try {
        setIsLoading(true);
        
        // Get all stages for this category
        const { data: categoryStages, error: stagesError } = await supabase
          .from('category_production_stages')
          .select(`
            production_stage_id,
            production_stages!inner(
              id,
              name,
              color,
              is_multi_part,
              part_definitions
            )
          `)
          .eq('category_id', categoryId);

        if (stagesError) throw stagesError;

        // Extract parts and collect multi-part stages
        const allParts = new Set<string>();
        const multiPartStages: any[] = [];
        let hasMultiPartStages = false;

        categoryStages?.forEach(stage => {
          const stageData = stage.production_stages as any;
          
          if (stageData.is_multi_part && stageData.part_definitions) {
            hasMultiPartStages = true;
            const parts = Array.isArray(stageData.part_definitions) 
              ? stageData.part_definitions.map((p: any) => String(p))
              : [];
            
            parts.forEach(part => allParts.add(part));

            // Add all multi-part stages, not just printing ones
            multiPartStages.push({
              stage_id: stageData.id,
              stage_name: stageData.name,
              stage_color: stageData.color,
              part_types: parts
            });
          }
        });

        setCategoryParts({
          availableParts: Array.from(allParts),
          multiPartStages,
          hasMultiPartStages
        });
      } catch (error) {
        console.error('Error loading category parts:', error);
        setCategoryParts({
          availableParts: [],
          multiPartStages: [],
          hasMultiPartStages: false
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCategoryParts();
  }, [categoryId]);

  return {
    ...categoryParts,
    isLoading
  };
};
