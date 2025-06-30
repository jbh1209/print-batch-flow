import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobOverviewCard } from "./JobOverviewCard";
import { CurrentStageCard } from "./CurrentStageCard";
import { JobNotesCard } from "./JobNotesCard";
import { PartPrintingStageSelector } from "./PartPrintingStageSelector";
import { JobActionButtons } from "../common/JobActionButtons";
import { BatchAllocationSection } from "./dtp/BatchAllocationSection";
import { BatchCategorySelector } from "../batch-allocation/BatchCategorySelector";
import { BatchJobFormRHF } from "../batch-allocation/BatchJobFormRHF";
import { Play, CheckCircle, Mail, ThumbsUp, ArrowRight, Pause, Package, Printer } from "lucide-react";
import { getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePartPrintingAssignment } from "@/hooks/tracker/usePartPrintingAssignment";
import { useJobPrintingStages } from "@/hooks/tracker/useJobPrintingStages";
import { useJobStageInstances } from "@/hooks/tracker/useJobStageInstances";

interface DtpJobModalProps {
  job: AccessibleJob;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
}

interface StageInstance {
  id: string;
  status: string;
  proof_emailed_at?: string;
  proof_approved_manually_at?: string;
  client_email?: string;
  client_name?: string;
}

type ProofApprovalFlow = 'pending' | 'choosing_allocation' | 'batch_allocation' | 'direct_printing';

export const DtpJobModal: React.FC<DtpJobModalProps> = ({
  job,
  isOpen,
  onClose,
  onRefresh,
  onStart,
  onComplete
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [selectedPrintingStage, setSelectedPrintingStage] = useState<string>("");
  const [allPrintingStages, setAllPrintingStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [jobParts, setJobParts] = useState<string[]>([]);
  const [partAssignments, setPartAssignments] = useState<Record<string, string>>({});
  const [showPartSelector, setShowPartSelector] = useState(false);
  const [localJobStatus, setLocalJobStatus] = useState(job.status);
  const [localStageStatus, setLocalStageStatus] = useState(job.current_stage_status);
  const [stageInstance, setStageInstance] = useState<StageInstance | null>(null);
  
  // New states for batch allocation flow
  const [proofApprovalFlow, setProofApprovalFlow] = useState<ProofApprovalFlow>('pending');
  const [selectedBatchCategory, setSelectedBatchCategory] = useState<string>("");

  const { assignPartsToStages, getJobParts, isAssigning } = usePartPrintingAssignment();
  const { printingStages: existingPrintingStages, isLoading: printingStagesLoading } = useJobPrintingStages(job.job_id);
  
  // Use the job stage instances hook for proper workflow management
  const {
    jobStages,
    isLoading: isStageInstancesLoading,
    advanceJobStage,
    updateStageNotes
  } = useJobStageInstances(job.job_id, 'production_jobs');

  const statusBadgeInfo = getJobStatusBadgeInfo({
    ...job,
    status: localJobStatus,
    current_stage_status: localStageStatus
  });

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        // Reset local state when modal opens
        setLocalJobStatus(job.status);
        setLocalStageStatus(job.current_stage_status);
        setNotes("");
        setProofApprovalFlow('pending');
        setSelectedBatchCategory("");

        // Load current stage instance data
        if (job.current_stage_id) {
          const { data: stageData } = await supabase
            .from('job_stage_instances')
            .select('id, status, proof_emailed_at, proof_approved_manually_at, client_email, client_name')
            .eq('job_id', job.job_id)
            .eq('production_stage_id', job.current_stage_id)
            .single();

          if (stageData) {
            setStageInstance(stageData);
          } else {
            setStageInstance(null);
          }
        } else {
          setStageInstance(null);
        }

        // Load all available printing stages
        const { data: stages } = await supabase
          .from('production_stages')
          .select('id, name, color')
          .ilike('name', '%printing%')
          .eq('is_active', true)
          .order('name');

        if (stages) {
          setAllPrintingStages(stages);

          // If there are existing printing stages, pre-select the first one
          if (existingPrintingStages.length > 0) {
            setSelectedPrintingStage(existingPrintingStages[0].id);
          } else if (stages.length > 0) {
            setSelectedPrintingStage(stages[0].id);
          }
        } else {
          setAllPrintingStages([]);
          setSelectedPrintingStage("");
        }

        // Load job parts if the job has a category
        if (job.category_id) {
          const parts = await getJobParts(job.job_id, job.category_id);
          setJobParts(parts);
          setShowPartSelector(parts.length > 1);
        } else {
          setJobParts([]);
          setShowPartSelector(false);
        }
      };
      loadData();
    }
  }, [isOpen, job.category_id, job.job_id, job.status, job.current_stage_status, job.current_stage_id, getJobParts, existingPrintingStages]);

  const getCurrentStage = () => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    if (stageName.includes('dtp')) return 'dtp';
    if (stageName.includes('proof')) return 'proof';
    return 'unknown';
  };

  const getStageStatus = () => {
    return localStageStatus || 'pending';
  };

  const currentStage = getCurrentStage();
  const stageStatus = getStageStatus();

  const handleStartDTP = async () => {
    if (onStart && job.current_stage_id) {
      const success = await onStart(job.job_id, job.current_stage_id);
      if (success) {
        setLocalStageStatus('active');
        setLocalJobStatus('In Progress');
        onRefresh?.();
      }
      return;
    }

    // Fallback to direct database call
    setIsLoading(true);
    try {
      const { error: startError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id)
        .eq('status', 'pending');

      if (startError) throw startError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'In Progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      setLocalStageStatus('active');
      setLocalJobStatus('In Progress');
      toast.success("DTP work started");
      onRefresh?.();
    } catch (error) {
      console.error('Error starting DTP:', error);
      toast.error("Failed to start DTP work");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteDTP = async () => {
    if (onComplete && job.current_stage_id) {
      const success = await onComplete(job.job_id, job.current_stage_id);
      if (success) {
        onRefresh?.();
        onClose();
      }
      return;
    }

    // Fallback to direct database call
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: notes || 'DTP work completed'
      });

      if (error) throw error;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Ready for Proof',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("DTP completed - moved to Proof");
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error completing DTP:', error);
      toast.error("Failed to complete DTP work");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartProof = async () => {
    setIsLoading(true);

    // Optimistic update
    setLocalStageStatus('active');
    setLocalJobStatus('Proof In Progress');

    try {
      const { error: startError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id)
        .eq('status', 'pending');

      if (startError) throw startError;

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
    } catch (error) {
      console.error('Error starting proof:', error);
      // Revert optimistic update
      setLocalStageStatus(job.current_stage_status);
      setLocalJobStatus(job.status);
      toast.error("Failed to start proof stage");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProofEmailed = async () => {
    setIsLoading(true);

    const currentTime = new Date().toISOString();

    try {
      // Update the stage instance with proof emailed timestamp
      const { error: proofError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: currentTime,
          updated_at: currentTime
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (proofError) throw proofError;

      // Update the job status
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Awaiting Client Sign Off',
          updated_at: currentTime
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      // Update local state to reflect changes
      setLocalJobStatus('Awaiting Client Sign Off');
      setStageInstance(prev => prev ? { ...prev, proof_emailed_at: currentTime } : null);

      toast.success("Proof marked as emailed");
      onRefresh?.();
    } catch (error) {
      console.error('Error marking proof as emailed:', error);
      toast.error("Failed to mark proof as emailed");
    } finally {
      setIsLoading(false);
    }
  };

  // Updated proof approval handler - now shows allocation options
  const handleProofApproved = async () => {
    setIsLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_approved_manually_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstance?.id);

      if (updateError) throw updateError;

      // Update stage instance state
      setStageInstance(prev => prev ? { ...prev, proof_approved_manually_at: new Date().toISOString() } : null);
      
      // Move to allocation choice flow
      setProofApprovalFlow('choosing_allocation');
      
      toast.success('Proof approved! Choose next step.');
    } catch (error) {
      console.error('Error marking proof as approved:', error);
      toast.error('Failed to mark proof as approved');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle batch allocation choice
  const handleBatchAllocation = () => {
    setProofApprovalFlow('batch_allocation');
  };

  // Handle direct printing choice
  const handleDirectPrinting = async () => {
    setProofApprovalFlow('direct_printing');
    // Proceed with existing direct printing logic
    await handleAdvanceToPrintingStage();
  };

  // Handle batch job creation completion
  const handleBatchJobCreated = () => {
    toast.success("Job successfully allocated to batch processing");
    onRefresh?.();
    onClose();
  };

  // Handle canceling batch allocation
  const handleCancelBatchAllocation = () => {
    setProofApprovalFlow('choosing_allocation');
    setSelectedBatchCategory("");
  };

  const handleAdvanceToPartSpecificPrinting = async () => {
    if (Object.keys(partAssignments).length !== jobParts.length) {
      toast.error("Please assign all parts to printing stages");
      return;
    }

    const success = await assignPartsToStages(
      job.job_id,
      job.current_stage_id,
      partAssignments,
      notes || 'Proof approved - parts assigned to specific printing stages'
    );

    if (success) {
      await supabase
        .from('production_jobs')
        .update({
          status: 'Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      toast.success("Job advanced to part-specific printing stages");
      onRefresh?.();
      onClose();
    }
  };

  // FIXED: Use proper workflow management instead of manual stage creation
  const handleAdvanceToPrintingStage = async () => {
    if (!selectedPrintingStage) {
      toast.error("Please select a printing stage");
      return;
    }

    if (!job.current_stage_id) {
      toast.error("No current stage found");
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Advancing to printing stage using proper workflow management');
      
      // Use the proper workflow system to advance the current stage
      const success = await advanceJobStage(
        job.current_stage_id,
        notes || 'Proof approved - advancing to printing'
      );

      if (!success) {
        throw new Error('Failed to advance job stage');
      }

      // Now create the printing stage instance using the established pattern
      const { error: insertError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: job.job_id,
          job_table_name: 'production_jobs',
          category_id: job.category_id,
          production_stage_id: selectedPrintingStage,
          stage_order: 1000, // Set high order for printing stages
          status: 'pending'
        });

      if (insertError) throw insertError;

      // Update job status
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      const selectedStage = allPrintingStages.find(s => s.id === selectedPrintingStage);
      toast.success(`Job advanced to ${selectedStage?.name || 'printing stage'}`);
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('❌ Error advancing to printing stage:', error);
      toast.error("Failed to advance to printing stage");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHoldJob = async (jobId: string, reason: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'on_hold',
          hold_reason: reason,
          held_at: new Date().toISOString(),
          held_by: user?.id
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', job.current_stage_id)
        .eq('status', 'active');

      if (error) throw error;

      setLocalStageStatus('on_hold');
      toast.success(`Job placed on hold: ${reason}`);
      onRefresh?.();
      return true;
    } catch (error) {
      console.error('Error placing job on hold:', error);
      toast.error('Failed to place job on hold');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const renderDTPActions = () => {
    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={handleStartDTP}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start DTP Work
        </Button>
      );
    }

    if (stageStatus === 'active') {
      return (
        <Button 
          onClick={handleCompleteDTP}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete DTP
        </Button>
      );
    }

    return null;
  };

  const renderProofActions = () => {
    const hasProofBeenEmailed = stageInstance?.proof_emailed_at;
    const hasProofBeenApproved = stageInstance?.proof_approved_manually_at;

    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={handleStartProof}
          disabled={isLoading}
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
            disabled={isLoading}
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
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Mark as Approved
            </Button>
          </div>
        );
      }

      // Proof has been approved - show allocation flow
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
                  onClick={handleBatchAllocation}
                  disabled={isLoading}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Send to Batch Processing
                </Button>
                
                <Button 
                  onClick={handleDirectPrinting}
                  disabled={isLoading || isStageInstancesLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  variant="outline"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {isStageInstancesLoading ? 'Processing...' : 'Send Directly to Printing'}
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
                  onSelectCategory={setSelectedBatchCategory}
                  selectedCategory={selectedBatchCategory}
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleCancelBatchAllocation}
                  variant="outline"
                  className="w-full"
                >
                  Back to Options
                </Button>
              </div>
            );
          } else {
            return (
              <div className="space-y-4">
                <BatchJobFormRHF
                  jobData={{
                    wo_no: job.wo_no,
                    customer: job.customer || '',
                    qty: job.qty || 1,
                    due_date: job.due_date ? new Date(job.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                  }}
                  batchCategory={selectedBatchCategory}
                  onJobCreated={handleBatchJobCreated}
                  onCancel={handleCancelBatchAllocation}
                  isProcessing={isLoading}
                />
              </div>
            );
          }
        }

        if (proofApprovalFlow === 'direct_printing') {
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-md">
                <Printer className="h-4 w-4" />
                <span className="text-sm font-medium">Select Printing Stage</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="printing-stage">Printing Stage</Label>
                <Select value={selectedPrintingStage} onValueChange={setSelectedPrintingStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select printing stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPrintingStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleAdvanceToPrintingStage}
                  disabled={isLoading || isStageInstancesLoading || !selectedPrintingStage}
                  className="flex-1"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {isLoading || isStageInstancesLoading ? 'Processing...' : 'Advance to Printing'}
                </Button>
                <Button 
                  onClick={() => setProofApprovalFlow('choosing_allocation')}
                  variant="outline"
                >
                  Back
                </Button>
              </div>
            </div>
          );
        }
      }
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Job Details: {job.wo_no}</span>
            <Badge 
              className={cn(statusBadgeInfo.className)}
              variant={statusBadgeInfo.variant}
            >
              {statusBadgeInfo.text}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <JobOverviewCard job={job} />
          <CurrentStageCard job={{...job, status: localJobStatus, current_stage_status: localStageStatus}} statusInfo={statusBadgeInfo} />
          <JobNotesCard notes={notes} onNotesChange={setNotes} />
        </div>

        {/* Action buttons based on current stage and status */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Job Actions</h4>
          
          {currentStage === 'dtp' && renderDTPActions()}
          {currentStage === 'proof' && renderProofActions()}
          
          {/* Fallback: Show universal job action buttons if no specific actions */}
          {!renderDTPActions() && !renderProofActions() && job.current_stage_id && (
            <JobActionButtons
              job={job}
              onStart={onStart || (() => Promise.resolve(false))}
              onComplete={onComplete || (() => Promise.resolve(false))}
              onJobUpdated={onRefresh}
              size="default"
              layout="vertical"
              showExpedite={true}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
