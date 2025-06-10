
export interface OptimisticCallbacks {
  onOptimisticUpdate?: (jobId: string, updates: any) => void;
  onOptimisticRevert?: (jobId: string, field: string, originalValue: any) => void;
}

export interface JobActionOptions {
  onSuccess?: () => void;
  callbacks?: OptimisticCallbacks;
}

export interface JobActionResult {
  startJob: (jobId: string, stageId: string) => Promise<boolean>;
  completeJob: (jobId: string, stageId: string) => Promise<boolean>;
  markJobCompleted: (jobId: string) => Promise<boolean>;
  optimisticUpdates: Record<string, any>;
  hasOptimisticUpdates: boolean;
}
