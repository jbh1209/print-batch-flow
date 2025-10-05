
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, RotateCcw, Mail, ThumbsUp, Upload, Pause } from "lucide-react";
import ProofLinkButton from "./ProofLinkButton";
import ProofUploadDialog from "./ProofUploadDialog";
import StageHoldDialog from "./StageHoldDialog";
import StageSubTaskButtons from "./StageSubTaskButtons";
import { supabase } from "@/integrations/supabase/client";
import { useProofApprovalFlow } from "@/hooks/tracker/useProofApprovalFlow";
import { useStageActions } from "@/hooks/tracker/stage-management/useStageActions";
import { toast } from "sonner";

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
    proof_emailed_at?: string | null;
    proof_approved_manually_at?: string | null;
    completion_percentage?: number;
    remaining_minutes?: number;
    hold_reason?: string;
    held_at?: string;
    scheduled_minutes?: number;
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
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [isMarkingProofEmailed, setIsMarkingProofEmailed] = useState(false);
  const [isMarkingProofApproved, setIsMarkingProofApproved] = useState(false);
  const { completeProofStage } = useProofApprovalFlow();
  const { holdStage, resumeStage, isProcessing: stageActionsProcessing } = useStageActions();

  if (!currentStage || !canWork) {
    return null;
  }

  // Core workflow logic: pending stages can be started, active stages can be completed, on_hold stages can be resumed
  const canStart = currentStage.status === 'pending';
  const canComplete = currentStage.status === 'active';
  const isOnHold = currentStage.status === 'on_hold';
  const isProofStage = currentStage.production_stage.name.toLowerCase().includes('proof');

  const handleHoldStage = async (percentage: number, reason: string) => {
    const success = await holdStage(currentStage.id, percentage, reason);
    if (success) {
      window.location.reload();
    }
  };

  const handleResumeStage = async () => {
    const success = await resumeStage(currentStage.id);
    if (success) {
      window.location.reload();
    }
  };

  const handleMarkProofEmailed = async () => {
    setIsMarkingProofEmailed(true);
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentStage.id);

      if (error) {
        console.error('Failed to mark proof as emailed:', error);
        toast.error('Failed to mark proof as emailed');
        return;
      }

      toast.success('Proof marked as emailed');
      window.location.reload();
    } catch (error) {
      console.error('Error marking proof as emailed:', error);
      toast.error('Failed to mark proof as emailed');
    } finally {
      setIsMarkingProofEmailed(false);
    }
  };

  const handleMarkProofApproved = async () => {
    setIsMarkingProofApproved(true);
    try {
      console.log(`🎯 Starting proof approval for job ${jobId}`);
      
      // Use the existing proof approval flow hook
      const success = await completeProofStage(jobId, currentStage.id);

      if (!success) {
        toast.error('Failed to approve proof');
        return;
      }

      console.log('✅ Proof approved and scheduling triggered');
      toast.success('Proof approved - job scheduled automatically');
      
      // Refresh to show updated stage
      window.location.reload();
    } catch (error) {
      console.error('❌ Error in proof approval flow:', error);
      toast.error('Failed to approve proof');
    } finally {
      setIsMarkingProofApproved(false);
    }
  };

  return (
    <div className="border-t pt-4 space-y-3">
      {/* Multi-Specification Sub-Tasks Display */}
      <StageSubTaskButtons
        stageInstanceId={currentStage.id}
        stageStatus={currentStage.status}
        isOnHold={isOnHold}
        onSubTaskComplete={() => {
          // Refresh stage data when sub-task is updated
          console.log('Sub-task updated, consider refreshing stage data');
        }}
      />

      {/* On Hold Status Display */}
      {isOnHold && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-orange-800">
              Stage On Hold - {currentStage.completion_percentage}% Complete
            </span>
            <span className="text-xs text-orange-600">
              {currentStage.remaining_minutes} mins remaining
            </span>
          </div>
          {currentStage.hold_reason && (
            <p className="text-xs text-orange-700">
              <strong>Reason:</strong> {currentStage.hold_reason}
            </p>
          )}
        </div>
      )}

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

        {canComplete && !isProofStage && (
          <>
            <Button
              onClick={() => setShowHoldDialog(true)}
              disabled={isProcessing || stageActionsProcessing}
              variant="outline"
              className="flex-1"
            >
              <Pause className="h-4 w-4 mr-2" />
              Hold Job
            </Button>
            <Button
              onClick={onCompleteJob}
              disabled={isProcessing || stageActionsProcessing}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Job
            </Button>
          </>
        )}

        {isOnHold && (
          <>
            <Button
              onClick={handleResumeStage}
              disabled={stageActionsProcessing}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume Job
            </Button>
            <Button
              onClick={onCompleteJob}
              disabled={isProcessing || stageActionsProcessing}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Remaining
            </Button>
          </>
        )}

        {(canComplete || isOnHold) && (
          <Button
            onClick={onReworkJob}
            disabled={isProcessing || stageActionsProcessing}
            variant="outline"
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Rework
          </Button>
        )}
      </div>

      {/* Proof Stage Specific Actions - only show when proof stage is active */}
      {isProofStage && canComplete && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Proof Actions:</div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleMarkProofEmailed}
              disabled={isMarkingProofEmailed || !!currentStage.proof_emailed_at}
              variant="outline"
              size="sm"
              className="bg-blue-50 hover:bg-blue-100 border-blue-200"
            >
              <Mail className="h-4 w-4 mr-1" />
              {currentStage.proof_emailed_at ? 'Proof Emailed ✓' : 'Mark as Emailed'}
            </Button>

            <Button
              onClick={handleMarkProofApproved}
              disabled={isMarkingProofApproved}
              variant="outline"
              size="sm"
              className="bg-green-50 hover:bg-green-100 border-green-200"
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              Mark as Approved
            </Button>
          </div>

          <Button
            onClick={() => setShowProofUpload(true)}
            variant="outline"
            size="sm"
            className="w-full bg-purple-50 hover:bg-purple-100 border-purple-200"
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload & Send Proof
          </Button>

          <ProofLinkButton
            stageInstanceId={currentStage.id}
            stageName={currentStage.production_stage.name}
            disabled={isProcessing}
          />
        </div>
      )}

      <ProofUploadDialog
        isOpen={showProofUpload}
        onClose={() => setShowProofUpload(false)}
        stageInstanceId={currentStage.id}
        onProofSent={() => {
          toast.success('Proof sent to client');
        }}
      />

      <StageHoldDialog
        isOpen={showHoldDialog}
        onClose={() => setShowHoldDialog(false)}
        onConfirm={handleHoldStage}
        scheduledMinutes={currentStage.scheduled_minutes || 0}
        stageName={currentStage.production_stage.name}
        isProcessing={stageActionsProcessing}
      />
    </div>
  );
};

export default JobModalActions;
