
import { JobStageWithDetails } from "@/hooks/tracker/useRealTimeJobStages/types";

export type ViewMode = "card" | "list";

export type StageColumnProps = {
  stage: any;
  jobStages: any[];
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
  viewMode: ViewMode;
  enableDnd?: boolean;
  onReorder?: (orderedIds: string[]) => void;
  registerReorder?: (fn: (newOrder: string[]) => void) => void;
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string) => void;
};

export interface DueInfo {
  color: string;
  label: string;
  code: "green" | "yellow" | "red" | "gray";
  warning?: boolean;
}
