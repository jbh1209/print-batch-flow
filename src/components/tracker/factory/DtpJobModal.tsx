
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  AlertTriangle,
  Play,
  CheckCircle,
  Pause,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobOverviewCard } from "./JobOverviewCard";
import { CurrentStageCard } from "./CurrentStageCard";
import { WorkInstructionsCard } from "./WorkInstructionsCard";
import { JobNotesCard } from "./JobNotesCard";
import { canStartJob, canCompleteJob, getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { toast } from "sonner";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const statusBadgeInfo = getJobStatusBadgeInfo(job);
  const canStart = canStartJob(job);
  const canComplete = canCompleteJob(job);

  const handleStartJob = async () => {
    if (!job.current_stage_id || !canStart) return;
    
    setIsProcessing(true);
    try {
      const success = await onStart(job.job_id, job.current_stage_id);
      if (success) {
        toast.success(`Started job ${job.wo_no}`);
        onClose();
      } else {
        toast.error('Failed to start job');
      }
    } catch (error) {
      console.error('Error starting job:', error);
      toast.error('Failed to start job');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!job.current_stage_id || !canComplete) return;
    
    setIsProcessing(true);
    try {
      const success = await onComplete(job.job_id, job.current_stage_id);
      if (success) {
        toast.success(`Completed job ${job.wo_no}`);
        onClose();
      } else {
        toast.error('Failed to complete job');
      }
    } catch (error) {
      console.error('Error completing job:', error);
      toast.error('Failed to complete job');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHoldJob = () => {
    // TODO: Implement hold functionality
    toast.info('Hold functionality coming soon');
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

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          {canStart && (
            <Button 
              onClick={handleStartJob}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? 'Starting...' : 'Start Job'}
            </Button>
          )}

          {canComplete && (
            <Button 
              onClick={handleCompleteJob}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4" />
              {isProcessing ? 'Completing...' : 'Complete Job'}
            </Button>
          )}

          <Button 
            onClick={handleHoldJob}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Pause className="h-4 w-4" />
            Hold Job
          </Button>

          <Button 
            onClick={onClose}
            variant="outline"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
