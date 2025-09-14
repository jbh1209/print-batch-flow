
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
import { CompactJobDetailsCard } from "./CompactJobDetailsCard";
import { getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { DtpJobActions } from "./dtp/DtpJobActions";
import { useDtpJobModal } from "./dtp/useDtpJobModal";
import { ConditionalStageRenderer } from "./ConditionalStageRenderer";
import { BatchSplitDetector } from "../batch/BatchSplitDetector";
import { BatchSplitDialog } from "../batch/BatchSplitDialog";
import { GlobalBarcodeListener } from "./GlobalBarcodeListener";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

  // Helper: log barcode scans
  const logScan = async (barcode_data: string, action_taken: string, scan_result: string) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('barcode_scan_log').insert({
        user_id: auth?.user?.id || null,
        job_id: job.job_id,
        stage_id: job.current_stage_id,
        job_table_name: 'production_jobs',
        barcode_data,
        action_taken,
        scan_result
      });
    } catch (e) {
      console.warn('⚠️ Failed to log barcode scan', e);
    }
  };

  // Helper: poll for active status after starting (prevents race conditions)
  const waitForActive = async (attempts = 8, delayMs = 250): Promise<boolean> => {
    const stageId = job.current_stage_id;
    if (!stageId) return false;
    for (let i = 0; i < attempts; i++) {
      try {
        const { data, error } = await supabase
          .from('job_stage_instances')
          .select('status, updated_at')
          .eq('job_id', job.job_id)
          .eq('production_stage_id', stageId)
          .eq('job_table_name', 'production_jobs')
          .order('updated_at', { ascending: false })
          .limit(1);
        if (!error) {
          const s = Array.isArray(data) ? (data[0] as any)?.status : (data as any)?.status;
          if (s === 'active') return true;
        }
      } catch {}
      await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
  };

  // Handle barcode scan with auto-proceed
  const handleBarcodeDetected = async (barcodeData: string) => {
    console.log('🔍 Barcode detected:', barcodeData, 'Expected:', job.wo_no);
    console.log('🔍 Current stage status (local):', localStageStatus, 'Hook stage status:', stageStatus);
    console.log('🔍 Callbacks -> onStart:', !!onStart, 'onComplete:', !!onComplete);
    
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
      await logScan(barcodeData, 'validation', 'valid');
      console.log('✅ Barcode validation passed');

      const stageId = job.current_stage_id;
      if (!stageId) {
        console.log('❌ No current stage ID on job');
        toast.error('No current stage available for this job');
        await logScan(barcodeData, 'start_or_complete', 'failure');
        return;
      }

      // Live status check from database for robustness
      const fetchLiveStatus = async (): Promise<string | null> => {
        try {
          const { data, error } = await supabase
            .from('job_stage_instances')
            .select('status, updated_at, created_at')
            .eq('job_id', job.job_id)
            .eq('production_stage_id', stageId)
            .eq('job_table_name', 'production_jobs')
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1);
          if (error) {
            console.error('❌ Live status fetch error:', error);
            return null;
          }
          const s = Array.isArray(data) ? (data[0] as any)?.status : (data as any)?.status;
          return s ?? null;
        } catch (e) {
          console.error('❌ Live status exception:', e);
          return null;
        }
      };

      const liveStatus = await fetchLiveStatus();
      const effectiveStatus = liveStatus || stageStatus || localStageStatus;
      console.log('🎯 Effective stage status:', effectiveStatus, '(live:', liveStatus, ')');
      
      if (effectiveStatus === 'pending') {
        if (!onStart || !onComplete) {
          toast.error('Actions unavailable to start/complete this stage');
          await logScan(barcodeData, 'start', 'failure');
          return;
        }
        toast.message('Starting stage from scan…');
        const started = await onStart(job.job_id, stageId);
        console.log('🎬 Start result:', started);
        await logScan(barcodeData, 'start', started ? 'success' : 'failure');
        if (!started) {
          toast.error('Failed to start stage. Please try again.');
          return;
        }
        // Wait until stage is active to avoid race condition
        const active = await waitForActive();
        if (!active) {
          toast.error('Stage did not become active, please retry.');
          await logScan(barcodeData, 'wait_active', 'timeout');
          return;
        }
        handleJobStatusUpdate('In Progress', 'active');
        await handleModalDataRefresh();
        toast.message('Completing just-started stage…');
        const completed = await onComplete(job.job_id, stageId);
        console.log('🏁 Complete-after-start result:', completed);
        await logScan(barcodeData, 'complete', completed ? 'success' : 'failure');
        if (completed) {
          handleJobStatusUpdate('Completed', 'completed');
          await handleModalDataRefresh();
          toast.success('Stage completed via barcode');
          onClose();
        } else {
          toast.error('Failed to complete after starting. Please try again.');
        }
      } else if (effectiveStatus === 'active') {
        if (!onComplete) {
          toast.error('Complete action unavailable');
          await logScan(barcodeData, 'complete', 'failure');
          return;
        }
        console.log('🏁 Attempting to complete job…');
        const completed = await onComplete(job.job_id, stageId);
        console.log('🏁 Complete result:', completed);
        await logScan(barcodeData, 'complete', completed ? 'success' : 'failure');
        if (completed) {
          handleJobStatusUpdate('Completed', 'completed');
          await handleModalDataRefresh();
          toast.success('Stage completed via barcode');
          onClose();
        } else {
          toast.error('Completion failed. Ensure the stage is active.');
        }
      } else {
        console.log('⚠️ Stage status not actionable:', effectiveStatus);
        toast.info(`Stage is ${effectiveStatus}. No action taken.`);
        await logScan(barcodeData, 'no_action', effectiveStatus);
      }
    } else {
      console.log('❌ Barcode validation failed');
      toast.error(`Wrong barcode scanned. Expected like: ${job.wo_no} (prefix optional). Got: ${barcodeData}`);
      await logScan(barcodeData, 'validation', 'invalid');
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

  // Ensure window focus when modal opens to capture barcode input
  React.useEffect(() => {
    if (isOpen) {
      // Focus the window to ensure barcode capture works
      window.focus();
      // Show listening state
      console.log('🎧 Modal opened - listening for barcode input...');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Global Barcode Listener - only active when modal is open */}
      {isOpen && (
        <GlobalBarcodeListener 
          onBarcodeDetected={handleBarcodeDetected}
          minLength={5}
        />
      )}
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-full sm:max-w-4xl h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Job Details: {job.wo_no}</span>
            <Badge 
              className={cn(statusBadgeInfo.className)}
              variant={statusBadgeInfo.variant}
            >
              {statusBadgeInfo.text}
            </Badge>
            {/* Barcode listening indicator */}
            <div className="ml-auto">
              <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                🎧 Listening for barcode...
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Enhanced barcode feedback */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Barcode Ready:</strong> Scan or type work order number{" "}
            <code className="bg-blue-100 px-1 rounded">{job.wo_no}</code>{" "}
            to {localStageStatus === 'pending' ? 'start' : 'complete'} this job.
          </p>
        </div>

        <div className="space-y-4">
          <CompactJobDetailsCard 
            job={{...job, status: localJobStatus, current_stage_status: localStageStatus}} 
            statusInfo={statusBadgeInfo}
            notes={notes}
            onNotesChange={setNotes}
          />
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
