import { supabase } from "@/integrations/supabase/client";

export interface TimingCalculationParams {
  quantity: number;
  stageId: string;
  specificationId?: string;
  stageData?: {
    running_speed_per_hour?: number;
    make_ready_time_minutes?: number;
    speed_unit?: string;
    ignore_excel_quantity?: boolean;
  };
  specificationData?: {
    running_speed_per_hour?: number;
    make_ready_time_minutes?: number;
    speed_unit?: string;
    ignore_excel_quantity?: boolean;
  };
}

export interface TimingEstimate {
  estimatedDurationMinutes: number;
  productionMinutes: number;
  makeReadyMinutes: number;
  speedUsed: number;
  speedUnit: string;
  calculationSource: 'specification' | 'stage' | 'default' | 'manual_override';
}

export class TimingCalculationService {
  // Calculate timing using the database function
  static async calculateStageTimingFromDB(
    quantity: number,
    runningSpeedPerHour: number,
    makeReadyTimeMinutes: number = 10,
    speedUnit: string = 'sheets_per_hour'
  ): Promise<number> {
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
      return this.calculateStageTimingLocally(quantity, runningSpeedPerHour, makeReadyTimeMinutes, speedUnit);
    }
  }

  // Local fallback calculation
  static calculateStageTimingLocally(
    quantity: number,
    runningSpeedPerHour: number,
    makeReadyTimeMinutes: number = 10,
    speedUnit: string = 'sheets_per_hour'
  ): number {
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
  }

  // Comprehensive timing calculation with inheritance and manual overrides
  static async calculateStageTimingWithInheritance(
    params: TimingCalculationParams
  ): Promise<TimingEstimate> {
    const { quantity, stageData, specificationData } = params;
    
    // Check if manual override is enabled (specification takes precedence over stage)
    const isManualOverride = specificationData?.ignore_excel_quantity || stageData?.ignore_excel_quantity;
    
    // Determine which data to use (specification overrides stage)
    const runningSpeed = specificationData?.running_speed_per_hour || stageData?.running_speed_per_hour;
    const makeReadyTime = specificationData?.make_ready_time_minutes || stageData?.make_ready_time_minutes || 10;
    const speedUnit = specificationData?.speed_unit || stageData?.speed_unit || 'sheets_per_hour';
    
    // Determine calculation source
    const calculationSource: TimingEstimate['calculationSource'] = 
      isManualOverride ? 'manual_override' :
      specificationData?.running_speed_per_hour ? 'specification' :
      stageData?.running_speed_per_hour ? 'stage' : 'default';

    // If manual override is enabled, return the fixed time (make-ready time becomes total duration)
    if (isManualOverride) {
      const fixedDuration = makeReadyTime;
      return {
        estimatedDurationMinutes: fixedDuration,
        productionMinutes: 0, // No production time in manual override
        makeReadyMinutes: fixedDuration,
        speedUsed: 0, // Not applicable for manual override
        speedUnit: 'manual_override',
        calculationSource
      };
    }

    // Use default values if no speed is provided
    const effectiveSpeed = runningSpeed || 1000; // Default: 1000 sheets per hour
    const effectiveMakeReady = makeReadyTime;
    const effectiveSpeedUnit = speedUnit;

    const totalDuration = await this.calculateStageTimingFromDB(
      quantity,
      effectiveSpeed,
      effectiveMakeReady,
      effectiveSpeedUnit
    );

    // Calculate production time separately for breakdown
    const productionMinutes = this.calculateStageTimingLocally(quantity, effectiveSpeed, 0, effectiveSpeedUnit);

    return {
      estimatedDurationMinutes: totalDuration,
      productionMinutes,
      makeReadyMinutes: effectiveMakeReady,
      speedUsed: effectiveSpeed,
      speedUnit: effectiveSpeedUnit,
      calculationSource
    };
  }
}