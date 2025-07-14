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
    const { quantity, stageId, specificationId } = params;
    
    let timingData = null;
    let calculationSource: TimingEstimate['calculationSource'] = 'default';
    
    // PHASE 1: Always query fresh stage specification data first (highest priority)
    if (specificationId) {
      try {
        const { data: stageSpec, error: specError } = await supabase
          .from('stage_specifications')
          .select('running_speed_per_hour, make_ready_time_minutes, speed_unit, ignore_excel_quantity')
          .eq('id', specificationId)
          .eq('is_active', true)
          .single();

        if (!specError && stageSpec && stageSpec.running_speed_per_hour) {
          timingData = stageSpec;
          calculationSource = stageSpec.ignore_excel_quantity ? 'manual_override' : 'specification';
          console.log(`🎯 Using LIVE stage specification timing: ${stageSpec.running_speed_per_hour} ${stageSpec.speed_unit || 'sheets_per_hour'}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch stage specification ${specificationId}:`, error);
      }
    }
    
    // PHASE 2: Fallback to production stage timing (if no specification found)
    if (!timingData && stageId) {
      try {
        const { data: productionStage, error: stageError } = await supabase
          .from('production_stages')
          .select('running_speed_per_hour, make_ready_time_minutes, speed_unit, ignore_excel_quantity')
          .eq('id', stageId)
          .eq('is_active', true)
          .single();

        if (!stageError && productionStage && productionStage.running_speed_per_hour) {
          timingData = productionStage;
          calculationSource = productionStage.ignore_excel_quantity ? 'manual_override' : 'stage';
          console.log(`📋 Using LIVE production stage timing: ${productionStage.running_speed_per_hour} ${productionStage.speed_unit || 'sheets_per_hour'}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch production stage ${stageId}:`, error);
      }
    }

    // FALLBACK: Use default timing values if no database timing found (fault-tolerant)
    if (!timingData) {
      console.warn(`⚠️ No timing data found for stage ${stageId} or specification ${specificationId}. Using fallback timing.`);
      timingData = {
        running_speed_per_hour: 100, // Default fallback speed
        make_ready_time_minutes: 10, // Default make-ready time
        speed_unit: 'sheets_per_hour',
        ignore_excel_quantity: false
      };
      calculationSource = 'default';
    }

    const { running_speed_per_hour, make_ready_time_minutes = 10, speed_unit = 'sheets_per_hour', ignore_excel_quantity } = timingData;

    // If manual override is enabled, return the fixed time (make-ready time becomes total duration)
    if (ignore_excel_quantity) {
      const fixedDuration = make_ready_time_minutes;
      return {
        estimatedDurationMinutes: fixedDuration,
        productionMinutes: 0, // No production time in manual override
        makeReadyMinutes: fixedDuration,
        speedUsed: 0, // Not applicable for manual override
        speedUnit: 'manual_override',
        calculationSource
      };
    }

    // Calculate using live database timing values
    const totalDuration = await this.calculateStageTimingFromDB(
      quantity,
      running_speed_per_hour,
      make_ready_time_minutes,
      speed_unit
    );

    // Calculate production time separately for breakdown
    const productionMinutes = this.calculateStageTimingLocally(quantity, running_speed_per_hour, 0, speed_unit);

    return {
      estimatedDurationMinutes: totalDuration,
      productionMinutes,
      makeReadyMinutes: make_ready_time_minutes,
      speedUsed: running_speed_per_hour,
      speedUnit: speed_unit,
      calculationSource
    };
  }
}