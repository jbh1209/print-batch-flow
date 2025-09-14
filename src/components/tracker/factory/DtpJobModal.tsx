
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
import { GlobalBarcodeListener } from "./GlobalBarcodeListener";
import { toast } from "sonner";
import { useBarcodeControlledActions } from "@/hooks/tracker/useBarcodeControlledActions";
// Removed QR code generator import - now using plain work order numbers

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

  // Barcode scanning integration - removed unused parts
  const {
    actionState,
    currentAction,
    scanResult
  } = useBarcodeControlledActions();

  // Reset local state when modal opens and auto-start scanning
  useEffect(() => {
    if (isOpen) {
      setLocalJobStatus(job.status);
      setLocalStageStatus(job.current_stage_status);
      setNotes("");
      loadModalData();
      
      // Auto-start scanning based on stage status
      const currentStageStatus = localStageStatus;
      if (currentStageStatus === 'pending') {
        handleStartWithBarcode();
      } else if (currentStageStatus === 'active') {
        handleCompleteWithBarcode();
      }
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

  // Handle barcode scan with auto-proceed
  const handleBarcodeDetected = async (barcodeData: string) => {
    console.log('🔍 Barcode detected:', barcodeData, 'Expected:', job.wo_no);
    
    // Verification - allow simple variations (prefix letters, extra whitespace)
    const normalize = (s: string) => (s || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const stripLetters = (s: string) => s.replace(/^[A-Z]+/, "");

    const cleanScanned = normalize(barcodeData);
    const cleanExpected = normalize(job.wo_no);
    const numericScanned = stripLetters(cleanScanned);
    const numericExpected = stripLetters(cleanExpected);

    const isValid =
      cleanScanned === cleanExpected ||
      numericScanned === numericExpected ||
      cleanScanned.includes(cleanExpected) ||
      cleanExpected.includes(cleanScanned) ||
      numericScanned.includes(numericExpected) ||
      numericExpected.includes(numericScanned);
    
    if (isValid) {
    // Auto-proceed after successful scan
      const currentStageStatus = localStageStatus;
      if (currentStageStatus === 'pending') {
        // Use the direct job action functions if available
        if (onStart && job.current_stage_id) {
          const success = await onStart(job.job_id, job.current_stage_id);
          if (success) {
            handleJobStatusUpdate('In Progress', 'active');
            handleModalDataRefresh();
          }
        }
      } else if (currentStageStatus === 'active') {
        if (onComplete && job.current_stage_id) {
          const success = await onComplete(job.job_id, job.current_stage_id);
          if (success) {
            handleJobStatusUpdate('Ready for Proof', 'completed');
            handleModalDataRefresh();
            onClose();
          }
        }
      }
    } else {
      toast.error(`Wrong barcode scanned. Expected like: ${job.wo_no} (prefix optional). Got: ${barcodeData}`);
    }
  };

  // Create barcode-enabled action handlers - simplified for auto-scanning
  const handleStartWithBarcode = async () => {
    // Auto-scanning is handled by the barcode listener
    console.log('Start with barcode initiated - waiting for scan...');
  };

  const handleCompleteWithBarcode = async () => {
    // Auto-scanning is handled by the barcode listener
    console.log('Complete with barcode initiated - waiting for scan...');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Global Barcode Listener - only active when modal is open */}
      {isOpen && (
        <GlobalBarcodeListener 
          onBarcodeDetected={handleBarcodeDetected}
          minLength={5}
        />
      )}
      <DialogContent className="max-w-full sm:max-w-4xl h-[90vh] overflow-y-auto p-3 sm:p-6">
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
            stageStatus={localStageStatus}
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
            onStartWithBarcode={handleStartWithBarcode}
            onCompleteWithBarcode={handleCompleteWithBarcode}
            barcodeActionState={actionState}
            currentBarcodeAction={currentAction}
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
