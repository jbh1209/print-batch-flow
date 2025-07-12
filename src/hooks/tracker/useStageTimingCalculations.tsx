import { useCallback } from "react";
import { TimingCalculationService } from "@/services/timingCalculationService";
import { useJobStageTimingUpdates } from "./useJobStageTimingUpdates";

// Re-export types for backward compatibility
export type { TimingCalculationParams, TimingEstimate } from "@/services/timingCalculationService";

export const useStageTimingCalculations = () => {
  const { updateJobStageInstanceTiming, batchCalculateTimingForJob } = useJobStageTimingUpdates();

  // Calculate timing using the database function
  const calculateStageTimingFromDB = useCallback(async (
    quantity: number,
    runningSpeedPerHour: number,
    makeReadyTimeMinutes: number = 10,
    speedUnit: string = 'sheets_per_hour'
  ): Promise<number> => {
    return TimingCalculationService.calculateStageTimingFromDB(
      quantity,
      runningSpeedPerHour,
      makeReadyTimeMinutes,
      speedUnit
    );
  }, []);

  // Local fallback calculation
  const calculateStageTimingLocally = useCallback((
    quantity: number,
    runningSpeedPerHour: number,
    makeReadyTimeMinutes: number = 10,
    speedUnit: string = 'sheets_per_hour'
  ): number => {
    return TimingCalculationService.calculateStageTimingLocally(
      quantity,
      runningSpeedPerHour,
      makeReadyTimeMinutes,
      speedUnit
    );
  }, []);

  // Comprehensive timing calculation with inheritance
  const calculateStageTimingWithInheritance = useCallback(async (
    params: import("@/services/timingCalculationService").TimingCalculationParams
  ) => {
    return TimingCalculationService.calculateStageTimingWithInheritance(params);
  }, []);

  return {
    calculateStageTimingFromDB,
    calculateStageTimingLocally,
    calculateStageTimingWithInheritance,
    updateJobStageInstanceTiming,
    batchCalculateTimingForJob
  };
};