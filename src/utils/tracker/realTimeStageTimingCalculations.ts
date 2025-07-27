import { TimingCalculationService } from "@/services/timingCalculationService";

/**
 * Real-time stage timing calculation utility
 * This ensures all UI components display consistent timing information
 * by always calculating timing from current stage configurations
 */

export interface StageTimingData {
  stageId: string;
  quantity: number;
  specificationId?: string | null;
}

export interface CalculatedStageTimingDisplay {
  displayMinutes: number;
  displayText: string;
  source: 'live_calculation' | 'stored_estimate' | 'fallback';
  isRecalculated?: boolean;
}

/**
 * Calculate real-time timing for display purposes
 * This should be used instead of relying on stored estimated_duration_minutes
 * to ensure timing displays are always accurate with current configurations
 */
export async function calculateRealTimeStageTimingForDisplay(
  timingData: StageTimingData
): Promise<CalculatedStageTimingDisplay> {
  try {
    const timingEstimate = await TimingCalculationService.calculateStageTimingWithInheritance({
      quantity: timingData.quantity,
      stageId: timingData.stageId,
      specificationId: timingData.specificationId
    });

    const displayMinutes = timingEstimate.estimatedDurationMinutes;
    const hours = Math.floor(displayMinutes / 60);
    const minutes = displayMinutes % 60;
    
    let displayText: string;
    if (hours === 0) {
      displayText = `${minutes}m`;
    } else if (minutes === 0) {
      displayText = `${hours}h`;
    } else {
      displayText = `${hours}h ${minutes}m`;
    }

    return {
      displayMinutes,
      displayText,
      source: 'live_calculation',
      isRecalculated: true
    };
  } catch (error) {
    console.warn('Failed to calculate real-time timing, using fallback:', error);
    return {
      displayMinutes: 0,
      displayText: '0m',
      source: 'fallback'
    };
  }
}

/**
 * Batch calculate real-time timing for multiple stages
 * More efficient than individual calculations when processing many stages
 */
export async function batchCalculateRealTimeStageTimingForDisplay(
  stages: StageTimingData[]
): Promise<CalculatedStageTimingDisplay[]> {
  const calculations = stages.map(stage => calculateRealTimeStageTimingForDisplay(stage));
  return Promise.all(calculations);
}

/**
 * Fallback to stored timing with indication that it may be outdated
 */
export function createStoredTimingDisplay(
  storedMinutes: number | null | undefined
): CalculatedStageTimingDisplay {
  const displayMinutes = storedMinutes || 0;
  const hours = Math.floor(displayMinutes / 60);
  const minutes = displayMinutes % 60;
  
  let displayText: string;
  if (displayMinutes === 0) {
    displayText = '0m';
  } else if (hours === 0) {
    displayText = `${minutes}m`;
  } else if (minutes === 0) {
    displayText = `${hours}h`;
  } else {
    displayText = `${hours}h ${minutes}m`;
  }

  return {
    displayMinutes,
    displayText,
    source: 'stored_estimate'
  };
}