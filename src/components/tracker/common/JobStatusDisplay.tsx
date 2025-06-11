
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, User, Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { 
  processJobStatus, 
  isJobOverdue, 
  isJobDueSoon,
  getJobStatusBadgeInfo
} from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

interface JobStatusDisplayProps {
  job: AccessibleJob;
  showDetails?: boolean;
  compact?: boolean;
  onRepairWorkflow?: (job: AccessibleJob) => void;
}

export const JobStatusDisplay: React.FC<JobStatusDisplayProps> = ({
  job,
  showDetails = true,
  compact = false,
  onRepairWorkflow
}) => {
  const isOverdue = isJobOverdue(job);
  const isDueSoon = isJobDueSoon(job);
  const jobStatus = processJobStatus(job);
  const statusBadgeInfo = getJobStatusBadgeInfo(job);

  const iconSize = compact ? "h-3 w-3" : "h-4 w-4";
  const textSize = compact ? "text-xs" : "text-sm";

  // Check if job has no stage (broken state)
  const hasNoStage = !job.current_stage_id || job.current_stage_id === '00000000-0000-0000-0000-000000000000';
  const hasCategory = job.category_id;
  const needsRepair = hasCategory && hasNoStage;

  // Use current stage name as the primary status display
  const displayStatus = hasNoStage 
    ? (hasCategory ? 'No Workflow' : 'No Category') 
    : (job.current_stage_name || job.current_stage_id || job.status || 'Unknown');

  return (
    <div className="space-y-2">
      {/* Status Badge - Use actual stage name or error state */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={hasNoStage ? "destructive" : statusBadgeInfo.variant}
          className={cn(
            "whitespace-nowrap", 
            hasNoStage ? "bg-red-100 text-red-800 border-red-300" : statusBadgeInfo.className, 
            compact && "text-xs px-2 py-0"
          )}
        >
          {displayStatus}
        </Badge>
        
        {jobStatus === 'active' && !hasNoStage && (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className={cn(iconSize, "animate-pulse")} />
            {!compact && <span className={cn("font-medium", textSize)}>Active</span>}
          </div>
        )}

        {needsRepair && onRepairWorkflow && (
          <button
            onClick={() => onRepairWorkflow(job)}
            className="flex items-center gap-1 text-orange-600 hover:text-orange-800 transition-colors"
            title="Repair workflow for this job"
          >
            <Wrench className={iconSize} />
            {!compact && <span className={cn("font-medium", textSize)}>Repair</span>}
          </button>
        )}
      </div>

      {/* Warning for broken state */}
      {needsRepair && showDetails && (
        <div className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className={cn(iconSize)} />
          <span className={cn("text-xs", "font-medium")}>
            Job has category but no workflow stages
          </span>
        </div>
      )}

      {/* Due Date */}
      {showDetails && job.due_date && (
        <div className="flex items-center gap-2">
          <Calendar className={cn("text-gray-400", iconSize)} />
          <span className={cn(
            "font-medium",
            isOverdue ? "text-red-600" : 
            isDueSoon ? "text-orange-600" : 
            "text-gray-700",
            textSize
          )}>
            {compact ? "" : "Due: "}{new Date(job.due_date).toLocaleDateString()}
          </span>
          {isOverdue && <AlertTriangle className={cn("text-red-500", iconSize)} />}
        </div>
      )}

      {/* Stage Info - Show workflow progress if available */}
      {showDetails && !hasNoStage && (
        <div className="flex items-center gap-2">
          <span className={cn("text-gray-500", textSize)}>
            {job.workflow_progress !== undefined ? 'Progress:' : 'Stage:'}
          </span>
          <span className={cn("font-medium text-gray-700", textSize)}>
            {job.workflow_progress !== undefined 
              ? `${job.workflow_progress}%`
              : displayStatus
            }
          </span>
        </div>
      )}
    </div>
  );
};
