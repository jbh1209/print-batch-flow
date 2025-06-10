
import { useCallback } from "react";
import { useOptimisticUpdates } from "./utils/optimisticUpdates";
import { startJobStage } from "./utils/jobStartUtils";
import { completeJobStage, markJobAsCompleted } from "./utils/jobCompletionUtils";
import { JobActionOptions, JobActionResult } from "./types/jobActionTypes";

export const useJobActions = (
  onSuccess?: () => void,
  callbacks?: JobActionOptions['callbacks']
): JobActionResult => {
  const {
    optimisticUpdates,
    applyOptimisticUpdate,
    revertOptimisticUpdate,
    clearOptimisticUpdate,
    hasOptimisticUpdates
  } = useOptimisticUpdates(callbacks);

  const startJob = useCallback(async (jobId: string, stageId: string): Promise<boolean> => {
    const success = await startJobStage(jobId, stageId, applyOptimisticUpdate, revertOptimisticUpdate);
    
    if (success) {
      clearOptimisticUpdate(jobId);
      onSuccess?.();
    }
    
    return success;
  }, [applyOptimisticUpdate, revertOptimisticUpdate, clearOptimisticUpdate, onSuccess]);

  const completeJob = useCallback(async (jobId: string, stageId: string): Promise<boolean> => {
    const success = await completeJobStage(jobId, stageId);
    
    if (success) {
      onSuccess?.();
    }
    
    return success;
  }, [onSuccess]);

  const markJobCompleted = useCallback(async (jobId: string): Promise<boolean> => {
    const success = await markJobAsCompleted(jobId);
    
    if (success) {
      onSuccess?.();
    }
    
    return success;
  }, [onSuccess]);

  return {
    startJob,
    completeJob,
    markJobCompleted,
    optimisticUpdates,
    hasOptimisticUpdates
  };
};
