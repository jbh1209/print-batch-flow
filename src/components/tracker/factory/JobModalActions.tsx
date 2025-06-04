
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

  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
      
      {job.user_can_work && job.current_stage_id && (
        <>
          {job.current_stage_status === 'pending' && (
            <Button 
              onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id!))}
              disabled={isActionInProgress}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isActionInProgress ? "Starting..." : "Start Job"}
            </Button>
          )}
          
          {job.current_stage_status === 'active' && (
            <Button 
              onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id!))}
              disabled={isActionInProgress}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isActionInProgress ? "Completing..." : "Complete Job"}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
