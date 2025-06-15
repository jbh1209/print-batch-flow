
import { getDueStatusColor } from "@/utils/tracker/trafficLightUtils";
import { JobStageWithDetails } from "@/hooks/tracker/useRealTimeJobStages/types";
import type { DueInfo } from "./StageColumn.types";

// Returns info about current due date for the stage card indicator.
export function getDueInfo(jobStage: any): DueInfo {
  const hasProductionJob = !!jobStage.production_job;
  if (!hasProductionJob) {
    // Log to console only ONCE per missing production_job, to avoid flooding
    if (jobStage._warned !== true) {
      console.warn(
        "⛔ Kanban: Stage instance missing production_job",
        jobStage
      );
      jobStage._warned = true; // mark so we don't repeat
    }
    return {
      color: "#F59E42", // amber-400
      label: "Job not found",
      code: "yellow",
      warning: true
    };
  }
  const due = jobStage.production_job?.due_date;
  const sla = jobStage.production_job?.sla_target_days ?? 3;
  if (!due) {
    return {
      color: "#F59E42", // amber-400
      label: "Missing Due Date",
      code: "yellow",
      warning: true
    };
  }
  return { ...getDueStatusColor(due, sla), warning: false };
}
