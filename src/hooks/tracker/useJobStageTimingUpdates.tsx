import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TimingCalculationService, type TimingCalculationParams } from "@/services/timingCalculationService";
import type { StageSpecification } from "./useStageSpecifications";

export const useJobStageTimingUpdates = () => {
  // Update job stage instance with calculated timing
  const updateJobStageInstanceTiming = useCallback(async (
    stageInstanceId: string,
    quantity: number,
    specificationId?: string | null
  ): Promise<boolean> => {
    try {
      console.log('🔄 Updating job stage instance timing...');

      // First, get the stage instance and related data
      const { data: stageInstance, error: stageError } = await supabase
        .from('job_stage_instances')
        .select(`
          *,
          production_stage:production_stages(
            running_speed_per_hour,
            make_ready_time_minutes,
            speed_unit,
            ignore_excel_quantity
          ),
          stage_specification:stage_specifications(
            running_speed_per_hour,
            make_ready_time_minutes,
            speed_unit,
            ignore_excel_quantity
          )
        `)
        .eq('id', stageInstanceId)
        .maybeSingle();

      if (stageError) {
        throw new Error(`Failed to fetch stage instance: ${stageError.message}`);
      }

      if (!stageInstance) {
        throw new Error('Stage instance not found');
      }

      // Calculate timing
      const timingEstimate = await TimingCalculationService.calculateStageTimingWithInheritance({
        quantity,
        stageId: stageInstance.production_stage_id,
        specificationId,
        stageData: stageInstance.production_stage,
        specificationData: stageInstance.stage_specification as StageSpecification | undefined
      });

      // Update the stage instance
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          quantity,
          stage_specification_id: specificationId,
          estimated_duration_minutes: timingEstimate.estimatedDurationMinutes,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      if (updateError) {
        throw new Error(`Failed to update stage instance timing: ${updateError.message}`);
      }

      console.log('✅ Job stage instance timing updated successfully');
      return true;
    } catch (err) {
      console.error('❌ Error updating job stage instance timing:', err);
      return false;
    }
  }, []);

  // Batch calculate timing for multiple stage instances
  const batchCalculateTimingForJob = useCallback(async (
    jobId: string,
    jobTableName: string,
    quantityByStage: Record<string, { quantity: number; specificationId?: string }>
  ): Promise<boolean> => {
    try {
      console.log('🔄 Batch calculating timing for job...');

      const updatePromises = Object.entries(quantityByStage).map(([stageInstanceId, { quantity, specificationId }]) =>
        updateJobStageInstanceTiming(stageInstanceId, quantity, specificationId)
      );

      const results = await Promise.all(updatePromises);
      const allSuccessful = results.every(result => result === true);

      if (allSuccessful) {
        console.log('✅ Batch timing calculation completed successfully');
      } else {
        console.warn('⚠️ Some timing calculations failed');
      }

      return allSuccessful;
    } catch (err) {
      console.error('❌ Error in batch timing calculation:', err);
      return false;
    }
  }, [updateJobStageInstanceTiming]);

  return {
    updateJobStageInstanceTiming,
    batchCalculateTimingForJob
  };
};