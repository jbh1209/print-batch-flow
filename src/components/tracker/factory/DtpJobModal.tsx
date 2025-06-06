
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobOverviewCard } from "./JobOverviewCard";
import { CurrentStageCard } from "./CurrentStageCard";
import { WorkInstructionsCard } from "./WorkInstructionsCard";
import { JobNotesCard } from "./JobNotesCard";
import JobModalActions from "./JobModalActions";
import { canStartJob, canCompleteJob, getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { useJobStageManagement } from "@/hooks/tracker/useJobStageManagement";

interface DtpJobModalProps {
  job: AccessibleJob;
  isOpen: boolean;
  onClose: () => void;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
}

export const DtpJobModal: React.FC<DtpJobModalProps> = ({
  job,
  isOpen,
  onClose,
  onStart,
  onComplete
}) => {
  const [notes, setNotes] = useState("");

  const statusBadgeInfo = getJobStatusBadgeInfo(job);
  const canWork = canStartJob(job) || canCompleteJob(job);

  // Use the job stage management hook to get current stage details
  const { jobStages, startStage, completeStage, isProcessing } = useJobStageManagement({
    jobId: job.job_id,
    jobTableName: 'production_jobs',
    categoryId: job.category_id || undefined
  });

  // Find the current stage from job stages
  const currentStage = jobStages.find(stage => 
    stage.status === 'active' || 
    (stage.status === 'pending' && stage.stage_order === Math.min(...jobStages.filter(s => s.status === 'pending').map(s => s.stage_order)))
  );

  const handleStartJob = async () => {
    if (!currentStage) return;
    
    const success = await startStage(currentStage.id);
    if (success) {
      onClose();
    }
  };

  const handleCompleteJob = async () => {
    if (!currentStage) return;
    
    const success = await completeStage(currentStage.id, notes);
    if (success) {
      onClose();
    }
  };

  const handleReworkJob = async () => {
    // TODO: Implement rework functionality
    console.log('Rework functionality to be implemented');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Job Details: {job.wo_no}</span>
            <Badge 
              className={cn(statusBadgeInfo.className)}
              variant={statusBadgeInfo.variant}
            >
              {statusBadgeInfo.text}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <JobOverviewCard job={job} />
          <CurrentStageCard job={job} statusInfo={statusBadgeInfo} />
          <WorkInstructionsCard job={job} />
          <JobNotesCard notes={notes} onNotesChange={setNotes} />
        </div>

        {/* Use JobModalActions for comprehensive proof functionality */}
        <JobModalActions
          jobId={job.job_id}
          currentStage={currentStage}
          canWork={canWork}
          onStartJob={handleStartJob}
          onCompleteJob={handleCompleteJob}
          onReworkJob={handleReworkJob}
          isProcessing={isProcessing}
        />
      </DialogContent>
    </Dialog>
  );
};
