
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PartAssignment {
  partName: string;
  stageId: string;
}

export const usePartPrintingAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  const assignPartsToStages = useCallback(async (
    jobId: string,
    currentStageId: string,
    partAssignments: Record<string, string>,
    notes?: string
  ) => {
    setIsAssigning(true);
    try {
      console.log('🔄 Assigning parts to printing stages...', { jobId, currentStageId, partAssignments });

      const { error } = await supabase.rpc('advance_job_stage_with_parts', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: currentStageId,
        p_part_assignments: partAssignments,
        p_notes: notes || 'Advanced to part-specific printing stages'
      });

      if (error) {
        console.error('❌ Error assigning parts to stages:', error);
        throw error;
      }

      console.log('✅ Parts assigned to printing stages successfully');
      toast.success("Parts assigned to printing stages successfully");
      return true;
    } catch (error) {
      console.error('❌ Error in part assignment:', error);
      toast.error("Failed to assign parts to printing stages");
      return false;
    } finally {
      setIsAssigning(false);
    }
  }, []);

  const getJobParts = useCallback(async (jobId: string, categoryId?: string) => {
    try {
      if (!categoryId) return [];

      // Get the category and its multi-part stages
      const { data: categoryStages, error } = await supabase
        .from('category_production_stages')
        .select(`
          production_stage_id,
          production_stages!inner(
            name,
            is_multi_part,
            part_definitions
          )
        `)
        .eq('category_id', categoryId)
        .eq('production_stages.is_multi_part', true);

      if (error) throw error;

      // Extract all unique parts from multi-part stages
      const allParts = new Set<string>();
      categoryStages?.forEach(stage => {
        const stage_data = stage.production_stages as any;
        if (stage_data.part_definitions && Array.isArray(stage_data.part_definitions)) {
          stage_data.part_definitions.forEach((part: string) => allParts.add(part));
        }
      });

      return Array.from(allParts);
    } catch (error) {
      console.error('Error getting job parts:', error);
      return [];
    }
  }, []);

  return {
    assignPartsToStages,
    getJobParts,
    isAssigning
  };
};
