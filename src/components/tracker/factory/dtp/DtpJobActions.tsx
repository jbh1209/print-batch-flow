
import React from "react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "../../common/JobActionButtons";
import { DtpStageActions } from "./DtpStageActions";
import { ProofStageActions } from "./ProofStageActions";

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
  onModalDataRefresh?: () => void;
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
  onModalDataRefresh
}) => {
  if (currentStage === 'dtp') {
    return (
      <DtpStageActions
        job={job}
        stageStatus={stageStatus}
        notes={notes}
        isLoading={isLoading}
        onStart={onStart}
        onComplete={onComplete}
        onRefresh={onRefresh}
        onClose={onClose}
        onJobStatusUpdate={onJobStatusUpdate}
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
        notes={notes}
        isLoading={isLoading}
        onRefresh={onRefresh}
        onClose={onClose}
        onJobStatusUpdate={onJobStatusUpdate}
        onProofApprovalFlowChange={onProofApprovalFlowChange}
        onBatchCategoryChange={onBatchCategoryChange}
        onModalDataRefresh={onModalDataRefresh}
      />
    );
  }

  // Fallback: Show universal job action buttons if no specific actions
  if (job.current_stage_id) {
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

  return null;
};
