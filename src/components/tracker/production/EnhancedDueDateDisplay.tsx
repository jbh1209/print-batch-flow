import React from "react";
import { format } from "date-fns";
import { DualDueDateDisplay } from "./DualDueDateDisplay";
import { TrafficLightIndicator } from "./TrafficLightIndicator";

interface EnhancedDueDateDisplayProps {
  job: {
    due_date?: string | null;
    original_committed_due_date?: string | null;
    wo_no: string;
  };
  className?: string;
  showTrafficLight?: boolean;
  variant?: "compact" | "detailed";
}

export const EnhancedDueDateDisplay: React.FC<EnhancedDueDateDisplayProps> = ({
  job,
  className = "",
  showTrafficLight = true,
  variant = "compact"
}) => {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  // Determine if there's a delay
  const hasDelay = job.original_committed_due_date && job.due_date && 
    new Date(job.due_date) > new Date(job.original_committed_due_date);

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showTrafficLight && (
          <TrafficLightIndicator 
            dueDate={job.due_date}
            originalCommittedDueDate={job.original_committed_due_date}
            showDetailed={hasDelay}
          />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {job.due_date ? formatDate(job.due_date) : "No due date"}
          </span>
          {hasDelay && job.original_committed_due_date && (
            <span className="text-xs text-muted-foreground">
              Original: {formatDate(job.original_committed_due_date)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        {showTrafficLight && (
          <TrafficLightIndicator 
            dueDate={job.due_date}
            originalCommittedDueDate={job.original_committed_due_date}
            showDetailed={true}
          />
        )}
        <div>
          <div className="font-medium text-sm">Current Due Date</div>
          <div className="text-sm">
            {job.due_date ? formatDate(job.due_date) : "Not set"}
          </div>
        </div>
      </div>

      {job.original_committed_due_date && (
        <div className="pl-5">
          <div className="text-xs text-muted-foreground font-medium">Original Commitment</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(job.original_committed_due_date)}
          </div>
          {hasDelay && (
            <div className="text-xs text-amber-600 font-medium mt-1">
              ⚠️ Job is behind original schedule
            </div>
          )}
        </div>
      )}
    </div>
  );
};