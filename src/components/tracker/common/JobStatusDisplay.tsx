
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, User, Clock } from "lucide-react";
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
}

export const JobStatusDisplay: React.FC<JobStatusDisplayProps> = ({
  job,
  showDetails = true,
  compact = false
}) => {
  const isOverdue = isJobOverdue(job);
  const isDueSoon = isJobDueSoon(job);
  const jobStatus = processJobStatus(job);
  const statusBadgeInfo = getJobStatusBadgeInfo(job);

  const iconSize = compact ? "h-3 w-3" : "h-4 w-4";
  const textSize = compact ? "text-xs" : "text-sm";

  // Use current stage name as the primary status display
  const displayStatus = job.current_stage_name || job.current_stage || job.status || 'No Workflow';

  return (
    <div className="space-y-2">
      {/* Status Badge - Use actual stage name */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={statusBadgeInfo.variant}
          className={cn("whitespace-nowrap", statusBadgeInfo.className, compact && "text-xs px-2 py-0")}
        >
          {displayStatus}
        </Badge>
        
        {jobStatus === 'active' && (
          <div className="flex items-center gap-1 text-blue-600">
            <Clock className={cn(iconSize, "animate-pulse")} />
            {!compact && <span className={cn("font-medium", textSize)}>Active</span>}
          </div>
        )}
      </div>

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
      {showDetails && (
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
