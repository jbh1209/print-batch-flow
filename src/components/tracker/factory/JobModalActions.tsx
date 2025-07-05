
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, RotateCcw, Mail, ThumbsUp, Upload } from "lucide-react";
import ProofLinkButton from "./ProofLinkButton";
import ProofUploadDialog from "./ProofUploadDialog";
import { supabase } from "@/integrations/supabase/client";
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
  const [isMarkingProofEmailed, setIsMarkingProofEmailed] = useState(false);
  const [isMarkingProofApproved, setIsMarkingProofApproved] = useState(false);

  if (!currentStage || !canWork) {
    return null;
  }

  // Core workflow logic: pending stages can be started, active stages can be completed
  const canStart = currentStage.status === 'pending';
  const canComplete = currentStage.status === 'active';
  const isProofStage = currentStage.production_stage.name.toLowerCase().includes('proof');

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
      
      // Mark proof as approved in stage instance
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_approved_manually_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentStage.id);

      if (updateError) {
        console.error('❌ Failed to mark proof as approved:', updateError);
        toast.error('Failed to mark proof as approved');
        return;
      }

      console.log('✅ Proof marked as approved, now advancing to batch allocation...');

      // Use the new function to properly advance to batch allocation
      const { data: advanceResult, error: advanceError } = await supabase
        .rpc('advance_job_to_batch_allocation', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs'
        });

      if (advanceError) {
        console.error('❌ Failed to advance job to batch allocation:', advanceError);
        toast.error(`Failed to advance to batch allocation: ${advanceError.message}`);
        // Fall back to normal completion if batch allocation fails
        onCompleteJob();
        return;
      }

      console.log('✅ Job successfully advanced to batch allocation:', advanceResult);
      toast.success('Proof approved - job moved to batch allocation stage');
      
      // Refresh to show updated stage
      window.location.reload();
    } catch (error) {
      console.error('❌ Error marking proof as approved:', error);
      toast.error('Failed to mark proof as approved');
    } finally {
      setIsMarkingProofApproved(false);
    }
  };

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

        {canComplete && !isProofStage && (
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
    </div>
  );
};

export default JobModalActions;
