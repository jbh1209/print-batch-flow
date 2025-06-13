
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
  job: AccessibleJob & { is_orphaned?: boolean };
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

  // Check if job is orphaned (enhanced detection)
  const isOrphaned = job.is_orphaned || (job.category_id && (!job.current_stage_id || job.current_stage_id === '00000000-0000-0000-0000-000000000000'));
  const hasCategory = !!job.category_id;
  const hasStage = job.current_stage_id && job.current_stage_id !== '00000000-0000-0000-0000-000000000000';

  // Use current stage name as the primary status display
  let displayStatus: string;
  let badgeVariant: "default" | "secondary" | "destructive" | "outline";
  let badgeClassName: string;

  if (isOrphaned) {
    displayStatus = 'Needs Repair';
    badgeVariant = "destructive";
    badgeClassName = "bg-orange-100 text-orange-800 border-orange-300";
  } else if (!hasCategory) {
    displayStatus = 'No Category';
    badgeVariant = "outline";
    badgeClassName = "bg-gray-100 text-gray-600 border-gray-300";
  } else if (!hasStage) {
    displayStatus = 'No Workflow';
    badgeVariant = "destructive";
    badgeClassName = "bg-red-100 text-red-800 border-red-300";
  } else {
    displayStatus = job.current_stage_name || job.current_stage_id || job.status || 'Unknown';
    badgeVariant = statusBadgeInfo.variant;
    badgeClassName = statusBadgeInfo.className;
  }

  return (
    <div className="space-y-2">
      {/* Status Badge - Use actual stage name or error state */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={badgeVariant}
          className={cn(
            "whitespace-nowrap", 
            badgeClassName,
            compact && "text-xs px-2 py-0"
          )}
        >
          {displayStatus}
        </Badge>
        
        {jobStatus === 'active' && !isOrphaned && hasStage && (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className={cn(iconSize, "animate-pulse")} />
            {!compact && <span className={cn("font-medium", textSize)}>Active</span>}
          </div>
        )}

        {isOrphaned && onRepairWorkflow && (
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

      {/* Warning for orphaned state */}
      {isOrphaned && showDetails && (
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
      {showDetails && !isOrphaned && hasStage && (
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

      {/* Category Info for orphaned jobs */}
      {showDetails && isOrphaned && hasCategory && (
        <div className="flex items-center gap-2">
          <span className={cn("text-gray-500", textSize)}>Category:</span>
          <span className={cn("font-medium text-gray-700", textSize)}>
            {job.category_name || 'Unknown'}
          </span>
        </div>
      )}
    </div>
  );
};
