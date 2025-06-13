
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      console.log('🔄 Starting part assignment process...', { jobId, currentStageId, partAssignments });

      // First, complete the current stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: notes || 'Stage completed - parts assigned to printing stages'
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', currentStageId)
        .eq('status', 'active');

      if (completeError) {
        console.error('❌ Error completing current stage:', completeError);
        throw completeError;
      }

      // Create new stage instances for each part assignment
      for (const [partName, stageId] of Object.entries(partAssignments)) {
        // Check if this combination already exists to prevent duplicates
        const { data: existing } = await supabase
          .from('job_stage_instances')
          .select('id')
          .eq('job_id', jobId)
          .eq('production_stage_id', stageId)
          .eq('part_name', partName)
          .maybeSingle();

        if (existing) {
          console.log(`⚠️ Stage instance already exists for ${partName} in stage ${stageId}`);
          continue;
        }

        // Insert new stage instance
        const { error: insertError } = await supabase
          .from('job_stage_instances')
          .insert({
            job_id: jobId,
            job_table_name: 'production_jobs',
            production_stage_id: stageId,
            part_name: partName,
            stage_order: 999, // High order for printing stages
            status: 'pending'
          });

        if (insertError) {
          console.error('❌ Error creating stage instance:', insertError);
          throw insertError;
        }
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
