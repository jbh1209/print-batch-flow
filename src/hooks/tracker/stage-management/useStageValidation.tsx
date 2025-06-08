
import { useCallback } from "react";

export const useStageValidation = (jobStages: any[]) => {
  const canStartStage = useCallback((stageId: string) => {
    const stage = jobStages.find(stage => stage.id === stageId);
    if (!stage) return false;
    return stage.status === 'pending';
  }, [jobStages]);

  const canAdvanceStage = useCallback((stageId: string) => {
    const currentStage = jobStages.find(stage => stage.id === stageId);
    if (!currentStage) return false;
    return currentStage.status === 'active';
  }, [jobStages]);

  const canReworkStage = useCallback((stageId: string) => {
    const currentStage = jobStages.find(stage => stage.id === stageId);
    if (!currentStage) return false;
    return currentStage.status === 'active';
  }, [jobStages]);

  const getCurrentStage = useCallback(() => {
    return jobStages.find(stage => stage.status === 'active') || null;
  }, [jobStages]);

  const getNextStage = useCallback(() => {
    return jobStages.find(stage => stage.status === 'pending') || null;
  }, [jobStages]);

  return {
    canStartStage,
    canAdvanceStage,
    canReworkStage,
    getCurrentStage,
    getNextStage
  };
};
