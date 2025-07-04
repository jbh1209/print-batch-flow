
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

  const getAvailableReworkStages = useCallback((currentStageId: string) => {
    const currentStage = jobStages.find(stage => stage.production_stage_id === currentStageId);
    if (!currentStage) return [];
    
    return jobStages.filter(stage => 
      stage.stage_order < currentStage.stage_order &&
      ['completed', 'reworked'].includes(stage.status)
    );
  }, [jobStages]);

  return {
    canStartStage,
    canAdvanceStage,
    canReworkStage,
    getCurrentStage,
    getNextStage,
    getAvailableReworkStages
  };
};
