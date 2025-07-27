import React from 'react';
import { formatWorkingTimeDisplay, type WorkingDayBreakdown, type WorkingDayCapacity } from '@/utils/tracker/workingDayCalculations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Calendar } from 'lucide-react';

interface WorkingTimeDisplayProps {
  minutes: number;
  capacity?: WorkingDayCapacity;
  className?: string;
  showIcon?: boolean;
  showTooltip?: boolean;
}

export const WorkingTimeDisplay: React.FC<WorkingTimeDisplayProps> = ({
  minutes,
  capacity,
  className = "",
  showIcon = true,
  showTooltip = true
}) => {
  const workingTime = formatWorkingTimeDisplay(minutes, capacity);
  
  const getIcon = () => {
    if (!showIcon) return null;
    
    // Show calendar icon for multi-day work, clock for single-day
    return workingTime.workingDays > 1 ? (
      <Calendar className="w-3 h-3" />
    ) : (
      <Clock className="w-3 h-3" />
    );
  };

  const getColorClass = () => {
    if (workingTime.workingDays > 5) {
      return "text-destructive"; // More than a week - red
    } else if (workingTime.workingDays > 2) {
      return "text-warning"; // More than 2 days - amber
    } else {
      return "text-muted-foreground"; // Normal - gray
    }
  };

  const displayContent = (
    <div className={`flex items-center gap-1 ${getColorClass()} ${className}`}>
      {getIcon()}
      <span className="font-medium">{workingTime.displayText}</span>
    </div>
  );

  if (!showTooltip) {
    return displayContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {displayContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{workingTime.tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};