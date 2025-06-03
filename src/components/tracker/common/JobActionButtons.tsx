
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobActionButtonsProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
}

export const JobActionButtons: React.FC<JobActionButtonsProps> = ({
  job,
  onStart,
  onComplete,
  size = "sm",
  variant = "default"
}) => {
  if (!job.current_stage_id) {
    return null;
  }

  // Only show actions if user has work permission
  if (!job.user_can_work) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {job.current_stage_status === 'pending' && (
        <Button 
          size={size}
          variant={variant}
          onClick={() => onStart(job.job_id, job.current_stage_id!)}
          className="flex items-center gap-2"
        >
          <Play className="h-4 w-4" />
          Start
        </Button>
      )}
      
      {job.current_stage_status === 'active' && (
        <Button 
          size={size}
          onClick={() => onComplete(job.job_id, job.current_stage_id!)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-4 w-4" />
          Complete
        </Button>
      )}
    </div>
  );
};
