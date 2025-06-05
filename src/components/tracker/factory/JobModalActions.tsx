
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, RotateCcw } from "lucide-react";
import ProofLinkButton from "./ProofLinkButton";

interface JobModalActionsProps {
  jobId: string;
  currentStage: {
    id: string;
    production_stage_id: string;
    production_stage: {
      name: string;
      color: string;
    };
    status: string;
  } | null;
  canWork: boolean;
  onStartJob: () => void;
  onCompleteJob: () => void;
  onReworkJob: () => void;
  isProcessing: boolean;
}

const JobModalActions: React.FC<JobModalActionsProps> = ({
  jobId,
  currentStage,
  canWork,
  onStartJob,
  onCompleteJob,
  onReworkJob,
  isProcessing
}) => {
  if (!currentStage || !canWork) {
    return null;
  }

  const canStart = currentStage.status === 'pending';
  const canComplete = currentStage.status === 'active';

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex gap-2">
        {canStart && (
          <Button
            onClick={onStartJob}
            disabled={isProcessing}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Stage
          </Button>
        )}

        {canComplete && (
          <Button
            onClick={onCompleteJob}
            disabled={isProcessing}
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Stage
          </Button>
        )}

        {canComplete && (
          <Button
            onClick={onReworkJob}
            disabled={isProcessing}
            variant="outline"
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Rework
          </Button>
        )}
      </div>

      {/* Proof Link Button for proof stages */}
      {currentStage.status === 'active' && (
        <ProofLinkButton
          stageInstanceId={currentStage.id}
          stageName={currentStage.production_stage.name}
          disabled={isProcessing}
        />
      )}
    </div>
  );
};

export default JobModalActions;
