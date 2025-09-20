import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Mail, ThumbsUp, Package, Printer, ArrowRight, Scan } from "lucide-react";
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
  scanCompleted: boolean;
  isLoading: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onProofApprovalFlowChange: (flow: ProofApprovalFlow) => void;
  onBatchCategoryChange: (category: string) => void;
}

export const ProofStageActions: React.FC<ProofStageActionsProps> = ({
  job,
  stageStatus,
  stageInstance,
  proofApprovalFlow,
  selectedBatchCategory,
  scanCompleted,
  isLoading,
  onRefresh,
  onClose,
  onProofApprovalFlowChange,
  onBatchCategoryChange
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
    const stageInstanceId = await getCurrentStageInstanceId();
    if (!stageInstanceId) {
      toast.error("No current stage instance found");
      return;
    }

    try {
      const success = await startStage(stageInstanceId);
      
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

      toast.success("Proof marked as emailed");
      onRefresh?.();
    } catch (error) {
      console.error('Error marking proof as emailed:', error);
      toast.error("Failed to mark proof as emailed");
    }
  };

  const handleProofApproved = async () => {
    try {
      console.log(`🎯 Starting proof approval for job ${job.job_id}`);
      
      // Use proof approval flow hook to handle the complete workflow
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('User not authenticated');
        return;
      }

      // Call the proof approval edge function to handle the complete flow
      const { data, error } = await supabase.functions.invoke('proof-approval-flow', {
        body: {
          jobId: job.job_id,
          stageInstanceId: stageInstance?.id,
          userId: userData.user.id
        }
      });

      if (error) {
        console.error('❌ Proof approval flow failed:', error);
        toast.error('Failed to approve proof');
        return;
      }

      console.log('✅ Proof approved and scheduling triggered:', data);
      
      // IMMEDIATE STATE UPDATE for instant UI feedback
      onProofApprovalFlowChange('choosing_allocation');
      toast.success('Proof approved! Scheduling triggered. Choose next step.');
      
      // Delayed refresh to ensure database consistency 
      setTimeout(() => {
        onRefresh?.();
      }, 100);
      
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
        'Proof approved - sending to batch allocation'
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
      toast.error("Failed to send job to batch allocation");
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
        'Proof approved - advancing directly to printing'
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
      toast.error("Failed to advance to printing stage");
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
      <div className="space-y-3">
        <Button 
          onClick={handleStartProof}
          disabled={!scanCompleted || isLoading || isProcessing}
          className={`w-full ${scanCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          <Play className="h-4 w-4 mr-2" />
          {scanCompleted ? "Start Proof Process" : "Scan Required First"}
        </Button>
      </div>
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
