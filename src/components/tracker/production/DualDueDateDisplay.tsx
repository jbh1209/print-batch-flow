import React from "react";
import { format } from "date-fns";
import { getDueStatusColor } from "@/utils/tracker/trafficLightUtils";

interface DualDueDateDisplayProps {
  dueDate?: string | null;
  originalCommittedDueDate?: string | null;
  showDetailed?: boolean;
  className?: string;
}

export const DualDueDateDisplay: React.FC<DualDueDateDisplayProps> = ({
  dueDate,
  originalCommittedDueDate,
  showDetailed = false,
  className = ""
}) => {
  const [currentStatus, setCurrentStatus] = React.useState({
    color: "#9CA3AF",
    label: "Loading...",
    code: "gray" as "red" | "yellow" | "green" | "gray"
  });

  const [originalStatus, setOriginalStatus] = React.useState({
    color: "#9CA3AF", 
    label: "Loading...",
    code: "gray" as "red" | "yellow" | "green" | "gray"
  });

  React.useEffect(() => {
    const getStatuses = async () => {
      if (dueDate) {
        const current = await getDueStatusColor(dueDate);
        setCurrentStatus(current);
      }
      
      if (originalCommittedDueDate) {
        const original = await getDueStatusColor(originalCommittedDueDate);
        setOriginalStatus(original);
      }
    };

    getStatuses();
  }, [dueDate, originalCommittedDueDate]);

  // Determine if there's a delay
  const hasDelay = originalCommittedDueDate && dueDate && 
    new Date(dueDate) > new Date(originalCommittedDueDate);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd");
    } catch {
      return dateString;
    }
  };

  if (!dueDate) {
    return (
      <div className={`text-muted-foreground ${className}`}>
        No due date
      </div>
    );
  }

  // Simple display - just current due date
  if (!showDetailed || !originalCommittedDueDate || !hasDelay) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: currentStatus.color }}
        />
        <span className="text-sm font-medium">
          {formatDate(dueDate)}
        </span>
      </div>
    );
  }

  // Detailed display - show both dates with delay indicator
  return (
    <div className={`space-y-1 ${className}`}>
      {/* Current due date */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: currentStatus.color }}
        />
        <span className="text-sm font-medium">
          Due: {formatDate(dueDate)}
        </span>
      </div>
      
      {/* Original committed date with delay indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-border" />
        <span>
          Original: {formatDate(originalCommittedDueDate)}
        </span>
        {hasDelay && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
            Delayed
          </span>
        )}
      </div>
    </div>
  );
};