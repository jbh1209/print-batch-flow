import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { JobStageInstance } from "./useJobStageInstances";
import type { StageSpecification } from "./useStageSpecifications";

export interface TimingCalculationParams {
  quantity: number;
  stageId: string;
  specificationId?: string;
  stageData?: {
    running_speed_per_hour?: number;
    make_ready_time_minutes?: number;
    speed_unit?: string;
  };
  specificationData?: StageSpecification;
}

export interface TimingEstimate {
  estimatedDurationMinutes: number;
  productionMinutes: number;
  makeReadyMinutes: number;
  speedUsed: number;
  speedUnit: string;
  calculationSource: 'specification' | 'stage' | 'default';
}

export const useStageTimingCalculations = () => {
  // Calculate timing using the database function
  const calculateStageTimingFromDB = useCallback(async (
    quantity: number,
    runningSpeedPerHour: number,
    makeReadyTimeMinutes: number = 10,
    speedUnit: string = 'sheets_per_hour'
  ): Promise<number> => {
    try {
      const { data, error } = await supabase.rpc('calculate_stage_duration', {
        p_quantity: quantity,
        p_running_speed_per_hour: runningSpeedPerHour,
        p_make_ready_time_minutes: makeReadyTimeMinutes,
        p_speed_unit: speedUnit
      });

      if (error) {
        console.error('❌ Database timing calculation error:', error);
        throw new Error(`Failed to calculate stage duration: ${error.message}`);
      }

      return data || makeReadyTimeMinutes;
    } catch (err) {
      console.error('❌ Error calculating stage timing:', err);
      // Fallback to client-side calculation
      return calculateStageTimingLocally(quantity, runningSpeedPerHour, makeReadyTimeMinutes, speedUnit);
    }
  }, []);

  // Local fallback calculation
  const calculateStageTimingLocally = useCallback((
    quantity: number,
    runningSpeedPerHour: number,
    makeReadyTimeMinutes: number = 10,
    speedUnit: string = 'sheets_per_hour'
  ): number => {
    if (quantity <= 0 || runningSpeedPerHour <= 0) {
      return makeReadyTimeMinutes;
    }

    let productionMinutes = 0;

    switch (speedUnit) {
      case 'sheets_per_hour':
      case 'items_per_hour':
        productionMinutes = Math.ceil((quantity / runningSpeedPerHour) * 60);
        break;
      case 'minutes_per_item':
        productionMinutes = quantity * runningSpeedPerHour;
        break;
      default:
        productionMinutes = Math.ceil((quantity / runningSpeedPerHour) * 60);
    }

    return productionMinutes + makeReadyTimeMinutes;
  }, []);

  // Comprehensive timing calculation with inheritance
  const calculateStageTimingWithInheritance = useCallback(async (
    params: TimingCalculationParams
  ): Promise<TimingEstimate> => {
    const { quantity, stageData, specificationData } = params;
    
    // Determine which data to use (specification overrides stage)
    const runningSpeed = specificationData?.running_speed_per_hour || stageData?.running_speed_per_hour;
    const makeReadyTime = specificationData?.make_ready_time_minutes || stageData?.make_ready_time_minutes || 10;
    const speedUnit = specificationData?.speed_unit || stageData?.speed_unit || 'sheets_per_hour';
    
    // Determine calculation source
    const calculationSource: TimingEstimate['calculationSource'] = 
      specificationData?.running_speed_per_hour ? 'specification' :
      stageData?.running_speed_per_hour ? 'stage' : 'default';

    // Use default values if no speed is provided
    const effectiveSpeed = runningSpeed || 1000; // Default: 1000 sheets per hour
    const effectiveMakeReady = makeReadyTime;
    const effectiveSpeedUnit = speedUnit;

    const totalDuration = await calculateStageTimingFromDB(
      quantity,
      effectiveSpeed,
      effectiveMakeReady,
      effectiveSpeedUnit
    );

    // Calculate production time separately for breakdown
    const productionMinutes = calculateStageTimingLocally(quantity, effectiveSpeed, 0, effectiveSpeedUnit);

    return {
      estimatedDurationMinutes: totalDuration,
      productionMinutes,
      makeReadyMinutes: effectiveMakeReady,
      speedUsed: effectiveSpeed,
      speedUnit: effectiveSpeedUnit,
      calculationSource
    };
  }, [calculateStageTimingFromDB, calculateStageTimingLocally]);

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
            speed_unit
          ),
          stage_specification:stage_specifications(
            running_speed_per_hour,
            make_ready_time_minutes,
            speed_unit
          )
        `)
        .eq('id', stageInstanceId)
        .single();

      if (stageError) {
        throw new Error(`Failed to fetch stage instance: ${stageError.message}`);
      }

      // Calculate timing
      const timingEstimate = await calculateStageTimingWithInheritance({
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
  }, [calculateStageTimingWithInheritance]);

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
    calculateStageTimingFromDB,
    calculateStageTimingLocally,
    calculateStageTimingWithInheritance,
    updateJobStageInstanceTiming,
    batchCalculateTimingForJob
  };
};