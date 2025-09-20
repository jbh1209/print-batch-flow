
import React from "react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "../../common/JobActionButtons";
import { DtpStageActions } from "./DtpStageActions";
import { ProofStageActions } from "./ProofStageActions";
import { JobActionState, BarcodeJobAction } from "@/hooks/tracker/useBarcodeControlledActions";
import { useUserRole } from "@/hooks/tracker/useUserRole";

interface StageInstance {
  id: string;
  status: string;
  proof_emailed_at?: string;
  proof_approved_manually_at?: string;
  client_email?: string;
  client_name?: string;
}

type ProofApprovalFlow = 'pending' | 'choosing_allocation' | 'batch_allocation' | 'direct_printing';

interface DtpJobActionsProps {
  job: AccessibleJob;
  currentStage: 'dtp' | 'proof' | 'unknown';
  stageStatus: string;
  stageInstance: StageInstance | null;
  proofApprovalFlow: ProofApprovalFlow;
  selectedBatchCategory: string;
  notes: string;
  isLoading: boolean;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
  onRefresh?: () => void;
  onClose: () => void;
  onJobStatusUpdate: (status: string, stageStatus: string) => void;
  onProofApprovalFlowChange: (flow: ProofApprovalFlow) => void;
  onBatchCategoryChange: (category: string) => void;
  setStageInstance: (instance: StageInstance | null) => void;
  onModalDataRefresh?: () => void;
  onStartWithBarcode?: () => Promise<void>;
  onCompleteWithBarcode?: () => Promise<void>;
  barcodeActionState?: JobActionState;
  currentBarcodeAction?: BarcodeJobAction | null;
}

export const DtpJobActions: React.FC<DtpJobActionsProps> = ({
  job,
  currentStage,
  stageStatus,
  stageInstance,
  proofApprovalFlow,
  selectedBatchCategory,
  notes,
  isLoading,
  onStart,
  onComplete,
  onRefresh,
  onClose,
  onJobStatusUpdate,
  onProofApprovalFlowChange,
  onBatchCategoryChange,
  setStageInstance,
  onModalDataRefresh,
  onStartWithBarcode,
  onCompleteWithBarcode,
  barcodeActionState,
  currentBarcodeAction
}) => {
  if (currentStage === 'dtp') {
    return (
      <DtpStageActions
        job={job}
        stageStatus={stageStatus}
        scanCompleted={false} // Will be provided by parent modal
        onStart={onStart}
        onComplete={onComplete}
        onRefresh={onRefresh}
        onClose={onClose}
      />
    );
  }

  if (currentStage === 'proof') {
    return (
      <ProofStageActions
        job={job}
        stageStatus={stageStatus}
        stageInstance={stageInstance}
        proofApprovalFlow={proofApprovalFlow}
        selectedBatchCategory={selectedBatchCategory}
        scanCompleted={false} // Will be provided by parent modal
        isLoading={isLoading}
        onRefresh={onRefresh}
        onClose={onClose}
        onProofApprovalFlowChange={onProofApprovalFlowChange}
        onBatchCategoryChange={onBatchCategoryChange}
        setStageInstance={setStageInstance}
      />
    );
  }

  // Fallback: Show universal job action buttons only for admin/manager roles
  if (job.current_stage_id) {
    const { isAdmin, isManager } = useUserRole();
    
    // Only show fallback buttons for admin/manager, operators must use barcode flow
    if (isAdmin || isManager) {
      return (
        <JobActionButtons
          job={job}
          onStart={onStart || (() => Promise.resolve(false))}
          onComplete={onComplete || (() => Promise.resolve(false))}
          onJobUpdated={onRefresh}
          size="default"
          layout="vertical"
          showExpedite={true}
        />
      );
    }
  }

  return null;
};
