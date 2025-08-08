import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Mail, ThumbsUp, Package, Printer, ArrowRight } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { BatchCategorySelector } from "../../batch-allocation/BatchCategorySelector";
import { BatchJobFormRHF } from "../../batch-allocation/BatchJobFormRHF";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStageActions } from "@/hooks/tracker/stage-management/useStageActions";

interface StageInstance {
  id: string;
  status: string;
  proof_emailed_at?: string;
  proof_approved_manually_at?: string;
  client_email?: string;
  client_name?: string;
}

type ProofApprovalFlow = 'pending' | 'choosing_allocation' | 'batch_allocation' | 'direct_printing';

interface ProofStageActionsProps {
  job: AccessibleJob;
  stageStatus: string;
  stageInstance: StageInstance | null;
  proofApprovalFlow: ProofApprovalFlow;
  selectedBatchCategory: string;
  notes: string;
  isLoading: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onJobStatusUpdate: (status: string, stageStatus: string) => void;
  onProofApprovalFlowChange: (flow: ProofApprovalFlow) => void;
  onBatchCategoryChange: (category: string) => void;
  onModalDataRefresh?: () => void;
}

export const ProofStageActions: React.FC<ProofStageActionsProps> = ({
  job,
  stageStatus,
  stageInstance,
  proofApprovalFlow,
  selectedBatchCategory,
  notes,
  isLoading,
  onRefresh,
  onClose,
  onJobStatusUpdate,
  onProofApprovalFlowChange,
  onBatchCategoryChange,
  onModalDataRefresh
}) => {
  const { user } = useAuth();
  const { startStage, completeStage, completeStageAndSkipConditional, isProcessing } = useStageActions();

  // Get the current stage instance ID from the job stage instances
  const getCurrentStageInstanceId = async (): Promise<string | null> => {
    if (stageInstance?.id) {
      return stageInstance.id;
    }

    // Fallback: query for the current active proof stage instance
    const { data, error } = await supabase
      .from('job_stage_instances')
      .select('id')
      .eq('job_id', job.job_id)
      .eq('job_table_name', 'production_jobs')
      .eq('production_stage_id', job.current_stage_id)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      console.error('❌ Could not find current stage instance:', error);
      return null;
    }

    return data.id;
  };

  const handleStartProof = async () => {
    if (!job.current_stage_id) {
      toast.error("No current stage found");
      return;
    }

    try {
      const success = await startStage(job.current_stage_id);
      
      if (success) {
        const { error: jobError } = await supabase
          .from('production_jobs')
          .update({
            status: 'Proof In Progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.job_id);

        if (jobError) throw jobError;

        toast.success("Proof stage started");
        onJobStatusUpdate('Proof In Progress', 'active');
        onModalDataRefresh?.();
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error starting proof:', error);
      toast.error("Failed to start proof stage");
    }
  };

  const handleProofEmailed = async () => {
    const currentTime = new Date().toISOString();

    try {
      const { error: proofError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: currentTime,
          updated_at: currentTime
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (proofError) throw proofError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Awaiting Client Sign Off',
          updated_at: currentTime
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      onJobStatusUpdate('Awaiting Client Sign Off', stageStatus);
      toast.success("Proof marked as emailed");
      onRefresh?.();
      onModalDataRefresh?.();
    } catch (error) {
      console.error('Error marking proof as emailed:', error);
      toast.error("Failed to mark proof as emailed");
    }
  };

  const handleProofApproved = async () => {
    try {
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_approved_manually_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstance?.id);

      if (updateError) throw updateError;

      onProofApprovalFlowChange('choosing_allocation');
      toast.success('Proof approved! Choose next step.');
      onRefresh?.();
      onModalDataRefresh?.();
    } catch (error) {
      console.error('Error marking proof as approved:', error);
      toast.error('Failed to mark proof as approved');
    }
  };

  const handleSendToBatchAllocation = async () => {
    const currentStageInstanceId = await getCurrentStageInstanceId();
    if (!currentStageInstanceId) {
      toast.error("No current stage instance found");
      return;
    }

    try {
      console.log('🔄 Completing proof stage and sending to batch allocation');
      
      // Complete the current proof stage using the stage instance ID
      const success = await completeStage(
        currentStageInstanceId,
        notes || 'Proof approved - sending to batch allocation'
      );

      if (!success) {
        throw new Error('Failed to complete proof stage');
      }

      // Update job status to indicate batch processing
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Batch Allocation',
          batch_category: selectedBatchCategory,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Job sent to batch allocation successfully");
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('❌ Error sending to batch allocation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to send job to batch allocation: ${errorMessage}`);
    }
  };

  const handleAdvanceToPrintingStage = async () => {
    const currentStageInstanceId = await getCurrentStageInstanceId();
    if (!currentStageInstanceId) {
      toast.error("No current stage instance found");
      return;
    }

    try {
      console.log('🔄 Completing proof stage and advancing to printing (skipping conditional stages)');
      
      // Complete the current proof stage and skip conditional stages using the correct stage instance ID
      const success = await completeStageAndSkipConditional(
        job.job_id,
        currentStageInstanceId,
        notes || 'Proof approved - advancing directly to printing'
      );

      if (!success) {
        throw new Error('Failed to complete proof stage and advance');
      }

      // Update job status to Ready to Print
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Job advanced to printing stage");
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('❌ Error advancing to printing stage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to advance to printing stage: ${errorMessage}`);
    }
  };

  const handleBatchJobCreated = async () => {
    // When batch job is created, we need to advance the main production job
    await handleSendToBatchAllocation();
  };

  const hasProofBeenEmailed = stageInstance?.proof_emailed_at;
  const hasProofBeenApproved = stageInstance?.proof_approved_manually_at;

  if (stageStatus === 'pending') {
    return (
      <Button 
        onClick={handleStartProof}
        disabled={isLoading || isProcessing}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        <Play className="h-4 w-4 mr-2" />
        Start Proof Process
      </Button>
    );
  }

  if (stageStatus === 'active') {
    if (!hasProofBeenEmailed) {
      return (
        <Button 
          onClick={handleProofEmailed}
          disabled={isLoading || isProcessing}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <Mail className="h-4 w-4 mr-2" />
          Proof Emailed
        </Button>
      );
    }

    if (hasProofBeenEmailed && !hasProofBeenApproved) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-md">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">Proof Emailed - Awaiting Client Response</span>
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            Emailed: {new Date(hasProofBeenEmailed).toLocaleDateString()} at {new Date(hasProofBeenEmailed).toLocaleTimeString()}
          </div>

          <Button 
            onClick={handleProofApproved}
            disabled={isLoading || isProcessing}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Mark as Approved
          </Button>
        </div>
      );
    }

    if (hasProofBeenApproved) {
      if (proofApprovalFlow === 'choosing_allocation') {
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-3 rounded-md">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm font-medium">Proof Approved - Choose Next Step</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={() => onProofApprovalFlowChange('batch_allocation')}
                disabled={isLoading || isProcessing}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Send to Batch Processing
              </Button>
              
              <Button 
                onClick={handleAdvanceToPrintingStage}
                disabled={isLoading || isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700"
                variant="outline"
              >
                <Printer className="h-4 w-4 mr-2" />
                {isLoading || isProcessing ? 'Processing...' : 'Send Directly to Printing'}
              </Button>
            </div>
          </div>
        );
      }

      if (proofApprovalFlow === 'batch_allocation') {
        if (!selectedBatchCategory) {
          return (
            <div className="space-y-4">
              <BatchCategorySelector
                onSelectCategory={onBatchCategoryChange}
                selectedCategory={selectedBatchCategory}
                disabled={isLoading || isProcessing}
              />
              <Button 
                onClick={() => onProofApprovalFlowChange('choosing_allocation')}
                variant="outline"
                className="w-full"
                disabled={isProcessing}
              >
                Back to Options
              </Button>
            </div>
          );
        } else {
          return (
            <div className="space-y-4">
              <BatchJobFormRHF
                wo_no={job.wo_no}
                customer={job.customer || ''}
                qty={job.qty || 1}
                due_date={job.due_date ? new Date(job.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                batchCategory={selectedBatchCategory}
                onJobCreated={handleBatchJobCreated}
                onCancel={() => onProofApprovalFlowChange('choosing_allocation')}
              />
            </div>
          );
        }
      }
    }
  }

  return null;
};
