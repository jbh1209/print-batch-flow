
import React from "react";
import { DtpActionButtons } from "./DtpActionButtons";
import { ProofAdvancementSection } from "./ProofAdvancementSection";

interface PrintingStage {
  id: string;
  name: string;
  color: string;
}

interface DtpWorkflowActionsProps {
  currentStage: 'dtp' | 'proof' | 'unknown';
  stageStatus: string;
  isLoading: boolean;
  showPartSelector: boolean;
  jobParts: string[];
  partAssignments: Record<string, string>;
  printingStages: PrintingStage[];
  selectedPrintingStage: string;
  isAssigning: boolean;
  onStartDtp: () => void;
  onCompleteDtp: () => void;
  onStartProof: () => void;
  onProofEmailed: () => void;
  onPartAssignmentsChange: (assignments: Record<string, string>) => void;
  onSelectedPrintingStageChange: (stageId: string) => void;
  onAdvanceToPartSpecificPrinting: () => void;
  onAdvanceToPrintingStage: () => void;
}

export const DtpWorkflowActions: React.FC<DtpWorkflowActionsProps> = ({
  currentStage,
  stageStatus,
  isLoading,
  showPartSelector,
  jobParts,
  partAssignments,
  printingStages,
  selectedPrintingStage,
  isAssigning,
  onStartDtp,
  onCompleteDtp,
  onStartProof,
  onProofEmailed,
  onPartAssignmentsChange,
  onSelectedPrintingStageChange,
  onAdvanceToPartSpecificPrinting,
  onAdvanceToPrintingStage
}) => {
  return (
    <div className="space-y-4">
      <DtpActionButtons
        currentStage={currentStage}
        stageStatus={stageStatus}
        isLoading={isLoading}
        onStartDtp={onStartDtp}
        onCompleteDtp={onCompleteDtp}
        onStartProof={onStartProof}
        onProofEmailed={onProofEmailed}
      />
      
      {currentStage === 'proof' && stageStatus === 'active' && (
        <ProofAdvancementSection
          showPartSelector={showPartSelector}
          jobParts={jobParts}
          partAssignments={partAssignments}
          onPartAssignmentsChange={onPartAssignmentsChange}
          printingStages={printingStages}
          selectedPrintingStage={selectedPrintingStage}
          onSelectedPrintingStageChange={onSelectedPrintingStageChange}
          isAssigning={isAssigning}
          isLoading={isLoading}
          onAdvanceToPartSpecificPrinting={onAdvanceToPartSpecificPrinting}
          onAdvanceToPrintingStage={onAdvanceToPrintingStage}
        />
      )}
    </div>
  );
};
