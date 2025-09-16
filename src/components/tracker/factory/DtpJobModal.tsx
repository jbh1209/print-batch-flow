
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobOverviewCard } from "./JobOverviewCard";
import { CurrentStageCard } from "./CurrentStageCard";
import { JobNotesCard } from "./JobNotesCard";
import { getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { DtpJobActions } from "./dtp/DtpJobActions";
import { useDtpJobModal } from "./dtp/useDtpJobModal";
import { ConditionalStageRenderer } from "./ConditionalStageRenderer";
import { BatchSplitDetector } from "../batch/BatchSplitDetector";
import { BatchSplitDialog } from "../batch/BatchSplitDialog";

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
  const [showBatchSplitDialog, setShowBatchSplitDialog] = useState(false);

  const {
    stageInstance,
    proofApprovalFlow,
    selectedBatchCategory,
    isLoading,
    getCurrentStage,
    getStageStatus,
    loadModalData,
    setProofApprovalFlow,
    setSelectedBatchCategory
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

  const handleModalDataRefresh = async () => {
    await loadModalData(); // This will refresh stageInstance and other modal data
    onRefresh?.(); // Also refresh the parent component to get updated job data
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

        {/* Batch Split Section - shows for batch master jobs at split-eligible stages */}
        <BatchSplitDetector job={job}>
          {({ isBatchJob, isReadyForSplit }) => 
            isBatchJob && isReadyForSplit && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Batch Operations
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  This batch is ready to be split back into individual jobs.
                </p>
                <Button
                  onClick={() => setShowBatchSplitDialog(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Split Batch to Individual Jobs
                </Button>
              </div>
            )
          }
        </BatchSplitDetector>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Job Actions</h4>
          
          <DtpJobActions
            job={job}
            currentStage={currentStage}
            stageStatus={stageStatus}
            stageInstance={stageInstance}
            proofApprovalFlow={proofApprovalFlow}
            selectedBatchCategory={selectedBatchCategory}
            notes={notes}
            isLoading={isLoading}
            onStart={onStart}
            onComplete={onComplete}
            onRefresh={onRefresh}
            onClose={onClose}
            onJobStatusUpdate={handleJobStatusUpdate}
            onProofApprovalFlowChange={setProofApprovalFlow}
            onBatchCategoryChange={setSelectedBatchCategory}
            onModalDataRefresh={handleModalDataRefresh}
          />
        </div>

        {/* Batch Split Dialog */}
        <BatchSplitDialog
          isOpen={showBatchSplitDialog}
          onClose={() => setShowBatchSplitDialog(false)}
          batchJob={job}
          onSplitComplete={() => {
            setShowBatchSplitDialog(false);
            handleModalDataRefresh();
            onRefresh?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
