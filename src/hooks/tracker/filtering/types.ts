
export interface UnifiedJobFilteringOptions {
  jobs: any[];
  statusFilter?: string | null;
  searchQuery?: string;
  categoryFilter?: string | null;
  stageFilter?: string | null;
}

export interface JobStats {
  total: number;
  pending: number;
  inProgress: number;
  completedToday: number;
  byStage: Record<string, number>;
}

export interface AccessCheckResult {
  isAccessible: boolean;
  accessReasons: {
    hasAccessibleWorkflowStages: boolean;
    currentStageAccessible: boolean;
    statusBasedAccess: boolean;
    noWorkflowAccess: boolean;
  };
}
