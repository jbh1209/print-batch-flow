
import { useState, useCallback } from "react";
import { OptimisticCallbacks } from "../types/jobActionTypes";

export const useOptimisticUpdates = (callbacks?: OptimisticCallbacks) => {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, any>>({});

  const applyOptimisticUpdate = useCallback((jobId: string, updates: any) => {
    callbacks?.onOptimisticUpdate?.(jobId, updates);
    setOptimisticUpdates(prev => ({ ...prev, [jobId]: updates }));
  }, [callbacks]);

  const revertOptimisticUpdate = useCallback((jobId: string, field: string, originalValue: any) => {
    callbacks?.onOptimisticRevert?.(jobId, field, originalValue);
    setOptimisticUpdates(prev => {
      const updated = { ...prev };
      delete updated[jobId];
      return updated;
    });
  }, [callbacks]);

  const clearOptimisticUpdate = useCallback((jobId: string) => {
    setOptimisticUpdates(prev => {
      const updated = { ...prev };
      delete updated[jobId];
      return updated;
    });
  }, []);

  const hasOptimisticUpdates = Object.keys(optimisticUpdates).length > 0;

  return {
    optimisticUpdates,
    applyOptimisticUpdate,
    revertOptimisticUpdate,
    clearOptimisticUpdate,
    hasOptimisticUpdates
  };
};
