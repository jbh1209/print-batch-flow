
import React, { useState, useEffect } from "react";
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
import { JobNotesCard } from "./JobNotesCard";
import { getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { DtpJobActions } from "./dtp/DtpJobActions";
import { useDtpJobModal } from "./dtp/useDtpJobModal";
import { ConditionalStageRenderer } from "./ConditionalStageRenderer";

interface DtpJobModalProps {
  job: AccessibleJob;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
}

export const DtpJobModal: React.FC<DtpJobModalProps> = ({
  job,
  isOpen,
  onClose,
  onRefresh,
  onStart,
  onComplete
}) => {
  const [notes, setNotes] = useState("");
  const [localJobStatus, setLocalJobStatus] = useState(job.status);
  const [localStageStatus, setLocalStageStatus] = useState(job.current_stage_status);

  const {
    stageInstance,
    proofApprovalFlow,
    selectedBatchCategory,
    selectedPrintingStage,
    allPrintingStages,
    isLoading,
    getCurrentStage,
    getStageStatus,
    loadModalData,
    setProofApprovalFlow,
    setSelectedBatchCategory,
    setSelectedPrintingStage
  } = useDtpJobModal(job, isOpen);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalJobStatus(job.status);
      setLocalStageStatus(job.current_stage_status);
      setNotes("");
      loadModalData();
    }
  }, [isOpen, job.status, job.current_stage_status, loadModalData]);

  const statusBadgeInfo = getJobStatusBadgeInfo({
    ...job,
    status: localJobStatus,
    current_stage_status: localStageStatus
  });

  const currentStage = getCurrentStage();
  const stageStatus = getStageStatus();

  const handleJobStatusUpdate = (newStatus: string, newStageStatus: string) => {
    setLocalJobStatus(newStatus);
    setLocalStageStatus(newStageStatus);
  };

  const handleModalDataRefresh = () => {
    loadModalData(); // This will refresh stageInstance and other modal data
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
          <CurrentStageCard job={{...job, status: localJobStatus, current_stage_status: localStageStatus}} statusInfo={statusBadgeInfo} />
          <JobNotesCard notes={notes} onNotesChange={setNotes} />
        </div>

        {/* Conditional Stage Renderer - shows for batch allocation and other conditional stages */}
        {job.current_stage_name === 'Batch Allocation' && (
          <div className="border-t pt-4">
            <ConditionalStageRenderer
              job={job}
              onStageComplete={() => {
                handleModalDataRefresh();
                onRefresh?.();
              }}
              onCancel={onClose}
            />
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Job Actions</h4>
          
          <DtpJobActions
            job={job}
            currentStage={currentStage}
            stageStatus={stageStatus}
            stageInstance={stageInstance}
            proofApprovalFlow={proofApprovalFlow}
            selectedBatchCategory={selectedBatchCategory}
            selectedPrintingStage={selectedPrintingStage}
            allPrintingStages={allPrintingStages}
            notes={notes}
            isLoading={isLoading}
            onStart={onStart}
            onComplete={onComplete}
            onRefresh={onRefresh}
            onClose={onClose}
            onJobStatusUpdate={handleJobStatusUpdate}
            onProofApprovalFlowChange={setProofApprovalFlow}
            onBatchCategoryChange={setSelectedBatchCategory}
            onPrintingStageChange={setSelectedPrintingStage}
            onModalDataRefresh={handleModalDataRefresh} // Pass the refresh function
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
