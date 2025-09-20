
import React, { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, Hash, Building, FileText } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { CurrentStageCard } from "../CurrentStageCard";
import { useDtpJobModal } from "./useDtpJobModal";
import { DtpStageActions } from "./DtpStageActions";
import { ProofStageActions } from "./ProofStageActions";

interface DtpJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: AccessibleJob;
  scanCompleted: boolean;
  onClearScan?: () => void;
  onRefresh?: () => void;
  onStartJob?: (jobId: string, stageId: string) => Promise<boolean>;
  onCompleteJob?: (jobId: string, stageId: string) => Promise<boolean>;
}

export const DtpJobModal: React.FC<DtpJobModalProps> = ({
  isOpen,
  onClose,
  job,
  scanCompleted,
  onClearScan,
  onRefresh,
  onStartJob,
  onCompleteJob
}) => {
  const {
    stageInstance,
    proofApprovalFlow,
    selectedBatchCategory,
    isLoading,
    getCurrentStage,
    getStageStatus,
    getStageIdForActions,
    loadModalData,
    setStageInstance,
    setProofApprovalFlow,
    setSelectedBatchCategory,
    setIsLoading
  } = useDtpJobModal(job, isOpen);

  // Wrap job action handlers to use the correct stage instance ID
  const handleStartJob = useCallback(async (jobId: string, _stageId: string) => {
    const correctStageId = getStageIdForActions();
    if (!correctStageId) {
      console.error('❌ No stage ID available for start action');
      return false;
    }
    console.log('🎬 DtpJobModal: Starting job with correct stage ID:', correctStageId);
    return onStartJob ? onStartJob(jobId, correctStageId) : false;
  }, [onStartJob, getStageIdForActions]);

  const handleCompleteJob = useCallback(async (jobId: string, _stageId: string) => {
    const correctStageId = getStageIdForActions();
    if (!correctStageId) {
      console.error('❌ No stage ID available for complete action');
      return false;
    }
    console.log('🏁 DtpJobModal: Completing job with correct stage ID:', correctStageId);
    return onCompleteJob ? onCompleteJob(jobId, correctStageId) : false;
  }, [onCompleteJob, getStageIdForActions]);

  // Load modal data when opened
  useEffect(() => {
    if (isOpen) {
      loadModalData();
    }
  }, [isOpen, loadModalData]);

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-full max-w-[95vw] md:max-w-4xl max-h-[95vh] overflow-y-auto p-4 md:p-6"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Job Details - {job.wo_no}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Scanning Status Card */}
          <Card className={`border-2 ${scanCompleted ? "border-green-500 bg-green-50" : "border-orange-500 bg-orange-50"}`}>
            <CardHeader>
              <CardTitle className={`text-lg flex items-center gap-2 ${scanCompleted ? "text-green-700" : "text-orange-700"}`}>
                <Hash className="w-5 h-5" />
                {scanCompleted ? "✓ Job Scanned Successfully" : `⚠ Scan Required - Work Order: ${job.wo_no}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!scanCompleted ? (
                <div className="text-center text-orange-700 font-medium">
                  Listening for barcode scan… Present the work order barcode to the scanner.
                </div>
              ) : (
                <div className="text-center text-green-700 font-medium">
                  ✓ Ready to start/complete work
                </div>
              )}
            </CardContent>
          </Card>

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

                  {job.contact && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        Contact
                      </p>
                      <p className="font-medium">{job.contact}</p>
                    </div>
                  )}
                  
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
                    scanCompleted={scanCompleted}
                    onStart={handleStartJob}
                    onComplete={handleCompleteJob}
                    onRefresh={onRefresh}
                    onClose={onClose}
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
                    scanCompleted={scanCompleted}
                    onClose={onClose}
                    onProofApprovalFlowChange={setProofApprovalFlow}
                    onBatchCategoryChange={setSelectedBatchCategory}
                    onRefresh={onRefresh}
                    setStageInstance={setStageInstance}
                  />
                )}
              </CardContent>
            </Card>
          </div>

            {/* Right Column - Current Stage Info */}
            <div className="space-y-4">
              <CurrentStageCard job={job} statusInfo={statusInfo} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
