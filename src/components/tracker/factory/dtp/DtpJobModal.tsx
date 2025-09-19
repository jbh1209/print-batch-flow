
import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, User, Hash, Building, FileText } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { CurrentStageCard } from "../CurrentStageCard";
import { useDtpJobModal } from "./useDtpJobModal";
import { DtpStageActions } from "./DtpStageActions";
import { ProofStageActions } from "./ProofStageActions";
import { useBarcodeControlledActions, BarcodeJobAction } from "@/hooks/tracker/useBarcodeControlledActions";
import { GlobalBarcodeListener } from "../GlobalBarcodeListener";
import { toast } from "sonner";

interface DtpJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: AccessibleJob;
  onRefresh?: () => void;
}

export const DtpJobModal: React.FC<DtpJobModalProps> = ({
  isOpen,
  onClose,
  job,
  onRefresh
}) => {
  const {
    stageInstance,
    proofApprovalFlow,
    selectedBatchCategory,
    isLoading,
    getCurrentStage,
    getStageStatus,
    loadModalData,
    setStageInstance,
    setProofApprovalFlow,
    setSelectedBatchCategory,
    setIsLoading
  } = useDtpJobModal(job, isOpen);

  // Barcode controlled actions
  const {
    actionState,
    currentAction,
    scanResult,
    startJobWithBarcode,
    proceedWithStart,
    completeJobWithBarcode,
    proceedWithComplete,
    cancelAction,
    resetState,
    processBarcodeForAction
  } = useBarcodeControlledActions();

  // Load modal data when opened and reset barcode state when closed
  useEffect(() => {
    if (isOpen) {
      loadModalData();
    } else {
      resetState();
      console.log('DTP modal closed - barcode state reset');
    }
  }, [isOpen, loadModalData, resetState]);

  // Handle barcode scanning for job actions
  const handleStartWithBarcode = async () => {
    if (!job.current_stage_id) {
      toast.error("No current stage to start");
      return;
    }

    const barcodeAction: BarcodeJobAction = {
      jobId: job.job_id,
      jobTableName: 'production_jobs',
      stageId: job.current_stage_id,
      expectedBarcodeData: job.wo_no || job.job_id,
      isBatchMaster: false
    };

    await startJobWithBarcode(barcodeAction);
  };

  const handleCompleteWithBarcode = async () => {
    if (!job.current_stage_id) {
      toast.error("No current stage to complete");
      return;
    }

    const barcodeAction: BarcodeJobAction = {
      jobId: job.job_id,
      jobTableName: 'production_jobs',
      stageId: job.current_stage_id,
      expectedBarcodeData: job.wo_no || job.job_id,
      isBatchMaster: false
    };

    await completeJobWithBarcode(barcodeAction);
  };

  // Handle barcode detection from scanner
  const handleBarcodeDetected = async (barcodeData: string) => {
    if (actionState === 'scanning' && currentAction) {
      const isValid = await processBarcodeForAction(barcodeData);
      if (isValid) {
        // Determine if this is a start or complete action based on current stage status
        const stageStatus = getStageStatus();
        if (stageStatus === 'pending') {
          await proceedWithStart();
        } else if (stageStatus === 'active') {
          await proceedWithComplete();
        }
        onRefresh?.();
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = () => {
    const status = getStageStatus();
    const stage = getCurrentStage();
    
    if (stage === 'proof' && stageInstance?.proof_approved_manually_at) {
      return {
        text: 'Proof Approved',
        className: 'bg-green-500 text-white',
        variant: 'default' as const
      };
    }
    
    if (status === 'active') {
      return {
        text: 'In Progress',
        className: 'bg-blue-500 text-white',
        variant: 'default' as const
      };
    }
    
    return {
      text: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending',
      className: 'bg-gray-500 text-white',
      variant: 'secondary' as const
    };
  };

  const statusInfo = getStatusBadge();

  return (
    <>
      {/* Barcode listener for modal actions */}
      {actionState === 'scanning' && (
        <GlobalBarcodeListener 
          onBarcodeDetected={handleBarcodeDetected}
          minLength={5}
          timeout={300}
        />
      )}
      
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] md:max-w-4xl max-h-[95vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Job Details - {job.wo_no}</span>
            <Badge variant="outline">{job.category_name || 'No Category'}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Left Column - Job Information */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Job Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      Customer
                    </p>
                    <p className="font-medium">{job.customer || 'Not specified'}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                      <Hash className="h-4 w-4" />
                      Quantity
                    </p>
                    <p className="font-medium">{job.qty ? job.qty.toLocaleString() : 'Not specified'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due Date
                    </p>
                    <p className="font-medium">
                      {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Reference
                    </p>
                    <p className="font-medium">{job.reference || 'Not specified'}</p>
                  </div>
                </div>

                {/* Proof Information for Proof Stage */}
                {getCurrentStage() === 'proof' && stageInstance && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Proof Information</h4>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Client Email:</span>
                          <span className="font-medium">{stageInstance.client_email || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Client Name:</span>
                          <span className="font-medium">{stageInstance.client_name || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Proof Emailed:</span>
                          <span className="font-medium">{formatDate(stageInstance.proof_emailed_at)}</span>
                        </div>
                        {stageInstance.proof_approved_manually_at && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Approved:</span>
                            <span className="font-medium text-green-600">
                              {formatDate(stageInstance.proof_approved_manually_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Stage Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stage Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {getCurrentStage() === 'dtp' && (
                  <DtpStageActions
                    job={job}
                    stageStatus={getStageStatus()}
                    notes=""
                    isLoading={isLoading}
                    onClose={onClose}
                    onJobStatusUpdate={() => {}}
                    onRefresh={onRefresh}
                    onStartWithBarcode={handleStartWithBarcode}
                    onCompleteWithBarcode={handleCompleteWithBarcode}
                    barcodeActionState={actionState}
                    currentBarcodeAction={currentAction}
                  />
                )}
                
                {getCurrentStage() === 'proof' && (
                  <ProofStageActions
                    job={job}
                    stageInstance={stageInstance}
                    proofApprovalFlow={proofApprovalFlow}
                    selectedBatchCategory={selectedBatchCategory}
                    isLoading={isLoading}
                    stageStatus={getStageStatus()}
                    notes=""
                    onClose={onClose}
                    onJobStatusUpdate={() => {}}
                    onProofApprovalFlowChange={setProofApprovalFlow}
                    onBatchCategoryChange={setSelectedBatchCategory}
                    onRefresh={onRefresh}
                    onStartWithBarcode={handleStartWithBarcode}
                    onCompleteWithBarcode={handleCompleteWithBarcode}
                    barcodeActionState={actionState}
                    currentBarcodeAction={currentAction}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Current Stage & Specifications */}
          <div className="space-y-4">
            <CurrentStageCard job={job} statusInfo={statusInfo} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};
