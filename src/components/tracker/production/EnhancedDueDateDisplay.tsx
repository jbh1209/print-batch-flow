import React from "react";
import { format } from "date-fns";
import { TrafficLightIndicator } from "./TrafficLightIndicator";
import { AlertTriangle } from "lucide-react";

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

  // Determine if there's a delay: current due date is later than original committed
  const hasDelay = job.original_committed_due_date && job.due_date && 
    new Date(job.due_date) > new Date(job.original_committed_due_date);

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showTrafficLight && (
          <TrafficLightIndicator 
            dueDate={job.due_date}
            originalCommittedDueDate={job.original_committed_due_date}
            showDetailed={false}
          />
        )}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-medium ${hasDelay ? 'text-amber-600 dark:text-amber-500' : ''}`}>
              {job.due_date ? formatDate(job.due_date) : "No due date"}
            </span>
            {hasDelay && (
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-500" />
            )}
          </div>
          {hasDelay && job.original_committed_due_date && (
            <span className="text-xs text-muted-foreground">
              Was: {formatDate(job.original_committed_due_date)}
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
            showDetailed={false}
          />
        )}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">Current Due Date</span>
            {hasDelay && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
            )}
          </div>
          <div className={`text-sm ${hasDelay ? 'text-amber-600 dark:text-amber-500 font-medium' : ''}`}>
            {job.due_date ? formatDate(job.due_date) : "Not set"}
          </div>
        </div>
      </div>

      {hasDelay && job.original_committed_due_date && (
        <div className="pl-5 bg-amber-50 dark:bg-amber-950/20 border-l-2 border-amber-500 py-1.5 px-2 rounded-r">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Original Commitment</div>
          <div className="text-xs text-amber-600 dark:text-amber-500">
            {formatDate(job.original_committed_due_date)}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-1">
            Delayed from original schedule
          </div>
        </div>
      )}
    </div>
  );
};