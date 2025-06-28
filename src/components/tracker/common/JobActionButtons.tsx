
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Pause } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { ExpediteButton } from "./ExpediteButton";
import { 
  canStartJob, 
  canCompleteJob,
  processJobStatus
} from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

interface JobActionButtonsProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold?: (jobId: string, reason: string) => Promise<boolean>;
  onJobUpdated?: () => void;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
  layout?: "horizontal" | "vertical";
  showHold?: boolean;
  showExpedite?: boolean;
  compact?: boolean;
}

export const JobActionButtons: React.FC<JobActionButtonsProps> = ({
  job,
  onStart,
  onComplete,
  onHold,
  onJobUpdated = () => {},
  size = "sm",
  variant = "default",
  layout = "horizontal",
  showHold = false,
  showExpedite = true,
  compact = false
}) => {
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [showHoldReasons, setShowHoldReasons] = useState(false);

  // Return null if no stage or no work permission
  if (!job.current_stage_id || !job.user_can_work) {
    return showExpedite ? (
      <ExpediteButton
        job={job as any}
        onJobUpdated={onJobUpdated}
        size={size}
        variant="outline"
        showLabel={!compact}
        compact={compact}
      />
    ) : null;
  }

  const jobStatus = processJobStatus(job);
  const showStartButton = canStartJob(job);
  const showCompleteButton = canCompleteJob(job);
  const showHoldButton = showHold && jobStatus === 'active' && onHold;

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActionInProgress(true);
    try {
      await action();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const holdReasons = [
    "Material shortage",
    "Equipment issue", 
    "Quality check needed",
    "Waiting for approval",
    "Break/Lunch",
    "Other"
  ];

  const containerClass = layout === "vertical" ? "flex flex-col gap-2" : "flex gap-2";
  const buttonClass = compact ? "h-7 text-xs" : size === "lg" ? "h-12 text-lg" : "h-8 text-sm";

  if (showHoldReasons && showHoldButton) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {holdReasons.map((reason) => (
            <Button
              key={reason}
              onClick={() => {
                handleAction(() => onHold!(job.job_id, reason));
                setShowHoldReasons(false);
              }}
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={isActionInProgress}
            >
              {reason}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => setShowHoldReasons(false)}
          variant="ghost"
          size="sm"
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {showStartButton && (
        <Button 
          size={size}
          variant={variant}
          onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id!))}
          className={`flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white ${buttonClass}`}
          disabled={isActionInProgress}
        >
          <Play className={compact ? "h-3 w-3" : "h-4 w-4"} />
          {compact ? "Start" : "Start Job"}
        </Button>
      )}
      
      {showCompleteButton && (
        <Button 
          size={size}
          onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id!))}
          className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white ${buttonClass}`}
          disabled={isActionInProgress}
        >
          <CheckCircle className={compact ? "h-3 w-3" : "h-4 w-4"} />
          {compact ? "Complete" : "Complete"}
        </Button>
      )}
      
      {showHoldButton && (
        <Button 
          onClick={() => setShowHoldReasons(true)}
          variant="outline"
          size={size}
          className={`flex items-center gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 ${buttonClass}`}
          disabled={isActionInProgress}
        >
          <Pause className={compact ? "h-3 w-3" : "h-4 w-4"} />
          {compact ? "Hold" : "Hold"}
        </Button>
      )}

      {showExpedite && (
        <ExpediteButton
          job={job as any}
          onJobUpdated={onJobUpdated}
          size={size}
          variant="outline"
          showLabel={!compact}
          compact={compact}
        />
      )}
    </div>
  );
};
