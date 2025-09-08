import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Scan, 
  Play, 
  CheckCircle, 
  Pause, 
  X, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBarcodeControlledActions, JobActionState } from "@/hooks/tracker/useBarcodeControlledActions";
import { GlobalBarcodeListener } from "./GlobalBarcodeListener";

interface BarcodeActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: {
    type: 'start' | 'complete';
    jobId: string;
    jobWo: string;
    stageId: string;
    stageName: string;
    expectedBarcodeData: string;
    isBatchMaster?: boolean;
    batchName?: string;
    constituentJobIds?: string[];
  } | null;
  onSuccess?: () => void;
}

const getStateInfo = (state: JobActionState) => {
  switch (state) {
    case 'idle':
      return { 
        color: 'bg-gray-100 text-gray-800', 
        label: 'Ready',
        icon: <Scan className="h-4 w-4" />
      };
    case 'scanning':
      return { 
        color: 'bg-blue-100 text-blue-800', 
        label: 'Scanning...',
        icon: <Scan className="h-4 w-4 animate-pulse" />
      };
    case 'working':
      return { 
        color: 'bg-green-100 text-green-800', 
        label: 'In Progress',
        icon: <Play className="h-4 w-4" />
      };
    case 'paused':
      return { 
        color: 'bg-yellow-100 text-yellow-800', 
        label: 'On Hold',
        icon: <Pause className="h-4 w-4" />
      };
    case 'completing':
      return { 
        color: 'bg-purple-100 text-purple-800', 
        label: 'Completing...',
        icon: <CheckCircle className="h-4 w-4 animate-spin" />
      };
  }
};

export const BarcodeActionModal: React.FC<BarcodeActionModalProps> = ({
  isOpen,
  onClose,
  action,
  onSuccess
}) => {
  const [manualBarcode, setManualBarcode] = useState("");
  const [notes, setNotes] = useState("");
  
  const {
    actionState,
    currentAction,
    scanResult,
    isProcessing,
    startJobWithBarcode,
    proceedWithStart,
    completeJobWithBarcode,
    proceedWithComplete,
    holdJob,
    resumeJob,
    cancelAction,
    processBarcodeForAction
  } = useBarcodeControlledActions();

  const stateInfo = getStateInfo(actionState);

  // Initialize action when modal opens
  useEffect(() => {
    if (isOpen && action && actionState === 'idle') {
      const barcodeAction = {
        jobId: action.jobId,
        jobTableName: 'production_jobs',
        stageId: action.stageId,
        expectedBarcodeData: action.expectedBarcodeData,
        isBatchMaster: action.isBatchMaster,
        batchName: action.batchName,
        constituentJobIds: action.constituentJobIds
      };

      if (action.type === 'start') {
        startJobWithBarcode(barcodeAction);
      } else {
        completeJobWithBarcode(barcodeAction, notes);
      }
    }
  }, [isOpen, action, actionState]);

  // Handle barcode detection
  const handleBarcodeDetected = async (barcodeData: string) => {
    if (actionState === 'scanning') {
      const success = await processBarcodeForAction(barcodeData);
      if (success) {
        setManualBarcode(barcodeData);
      }
    }
  };

  // Handle manual barcode entry
  const handleManualBarcodeSubmit = async () => {
    if (manualBarcode.trim()) {
      await processBarcodeForAction(manualBarcode.trim());
    }
  };

  // Handle proceed with action
  const handleProceed = async () => {
    let success = false;
    
    if (action?.type === 'start') {
      success = await proceedWithStart();
    } else {
      success = await proceedWithComplete(notes);
    }
    
    if (success) {
      onSuccess?.();
      handleClose();
    }
  };

  const handleClose = () => {
    cancelAction();
    setManualBarcode("");
    setNotes("");
    onClose();
  };

  if (!isOpen || !action) return null;

  return (
    <>
      <GlobalBarcodeListener onBarcodeDetected={handleBarcodeDetected} />
      
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {action.type === 'start' ? 'Start Job' : 'Complete Job'}
              <Badge className={cn("flex items-center gap-1", stateInfo.color)}>
                {stateInfo.icon}
                {stateInfo.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Job Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium">Job: {action.jobWo}</div>
              <div className="text-sm text-gray-600">Stage: {action.stageName}</div>
              {action.isBatchMaster && (
                <div className="text-sm text-purple-600">
                  Batch: {action.batchName}
                </div>
              )}
            </div>

            {/* Barcode Scanning Section */}
            {actionState === 'scanning' && (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Scan className="h-12 w-12 mx-auto text-blue-500 animate-pulse mb-2" />
                  <p className="text-sm font-medium">
                    Scan the barcode on the work order
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Or enter it manually below
                  </p>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Enter barcode manually"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualBarcodeSubmit()}
                  />
                  <Button 
                    onClick={handleManualBarcodeSubmit}
                    disabled={!manualBarcode.trim()}
                    size="sm"
                  >
                    Verify
                  </Button>
                </div>
              </div>
            )}

            {/* Scan Result */}
            {scanResult && (
              <div className={cn(
                "p-3 rounded-lg flex items-center gap-2",
                scanResult.success 
                  ? "bg-green-50 text-green-800" 
                  : "bg-red-50 text-red-800"
              )}>
                {scanResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {scanResult.success ? "Barcode Verified" : "Barcode Mismatch"}
                  </div>
                  {!scanResult.success && scanResult.error && (
                    <div className="text-xs">{scanResult.error}</div>
                  )}
                </div>
              </div>
            )}

            {/* Notes for completion */}
            {action.type === 'complete' && scanResult?.success && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Add any notes about the completed work..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Job Controls */}
            {actionState === 'working' && (
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Play className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Job In Progress
                  </span>
                </div>
                <Button
                  onClick={holdJob}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Hold Job
                </Button>
              </div>
            )}

            {actionState === 'paused' && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Pause className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Job On Hold
                  </span>
                </div>
                <Button
                  onClick={resumeJob}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume Job
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              
              {scanResult?.success && (actionState === 'scanning' || actionState === 'working' || actionState === 'paused') && (
                <Button
                  onClick={handleProceed}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {action.type === 'start' ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Job
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Job
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};