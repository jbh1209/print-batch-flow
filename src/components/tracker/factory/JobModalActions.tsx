
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  CheckCircle
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobModalActionsProps {
  job: AccessibleJob;
  onClose: () => void;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
}

export const JobModalActions: React.FC<JobModalActionsProps> = ({
  job,
  onClose,
  onStart,
  onComplete
}) => {
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  console.log(`🎬 Modal Actions for ${job.wo_no}:`, {
    current_stage_status: job.current_stage_status,
    current_stage_id: job.current_stage_id,
    current_stage_name: job.current_stage_name,
    user_can_work: job.user_can_work
  });

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActionInProgress(true);
    try {
      const success = await action();
      if (success) {
        onClose();
      }
    } finally {
      setIsActionInProgress(false);
    }
  };

  // Simplified action logic based on actual stage status
  const canWork = job.user_can_work;
  const hasStageInfo = job.current_stage_id && job.current_stage_name;
  const status = job.current_stage_status;
  
  const showStartButton = canWork && hasStageInfo && status === 'pending';
  const showCompleteButton = canWork && hasStageInfo && status === 'active';

  console.log(`🎯 Button visibility for ${job.wo_no}:`, {
    canWork,
    hasStageInfo,
    status,
    showStartButton,
    showCompleteButton
  });

  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
      
      {hasStageInfo && canWork && (
        <>
          {showStartButton && (
            <Button 
              onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id || 'default'))}
              disabled={isActionInProgress}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isActionInProgress ? "Starting..." : "Start Job"}
            </Button>
          )}
          
          {showCompleteButton && (
            <Button 
              onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id || 'default'))}
              disabled={isActionInProgress}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isActionInProgress ? "Completing..." : "Complete Job"}
            </Button>
          )}
        </>
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && !hasStageInfo && (
        <div className="text-xs text-gray-500 italic">
          No stage info available
        </div>
      )}
      
      {process.env.NODE_ENV === 'development' && !canWork && (
        <div className="text-xs text-gray-500 italic">
          No work permissions
        </div>
      )}
    </div>
  );
};
