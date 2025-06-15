
import React from "react";

export interface MultiStageKanbanColumnsProps {
  stages: any[];
  jobStages: any[];
  reorderRefs: React.MutableRefObject<Record<string, (order: string[]) => void>>;
  handleStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: "card" | "list";
  enableDnd: boolean;
  handleReorder: (stageId: string, order: string[]) => void;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}
