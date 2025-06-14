
import React, { useState } from "react";
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
import { Play, CheckCircle, Mail, ThumbsUp, ArrowRight } from "lucide-react";
import { getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePartPrintingAssignment } from "@/hooks/tracker/usePartPrintingAssignment";
import { useJobPrintingStages } from "@/hooks/tracker/useJobPrintingStages";

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

  const { assignPartsToStages, getJobParts, isAssigning } = usePartPrintingAssignment();
  const { printingStages: existingPrintingStages, isLoading: printingStagesLoading } = useJobPrintingStages(job.job_id);

  const statusBadgeInfo = getJobStatusBadgeInfo({
    ...job,
    status: localJobStatus,
    current_stage_status: localStageStatus
  });

  // Load data when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        // Reset local state when modal opens
        setLocalJobStatus(job.status);
        setLocalStageStatus(job.current_stage_status);
        
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
          }
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
          }
        }

        // Load job parts if the job has a category
        if (job.category_id) {
          const parts = await getJobParts(job.job_id, job.category_id);
          setJobParts(parts);
          setShowPartSelector(parts.length > 1);
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

      // Complete the current stage and advance
      if (onComplete && job.current_stage_id) {
        const success = await onComplete(job.job_id, job.current_stage_id);
        if (success) {
          toast.success('Proof approved and job advanced');
          onRefresh?.();
          onClose();
        }
      }
    } catch (error) {
      console.error('Error marking proof as approved:', error);
      toast.error('Failed to mark proof as approved');
    } finally {
      setIsLoading(false);
    }
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

  const handleAdvanceToPrintingStage = async () => {
    if (!selectedPrintingStage) {
      toast.error("Please select a printing stage");
      return;
    }

    setIsLoading(true);
    try {
      const { error: completeError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: notes || 'Proof approved - advancing to printing'
      });

      if (completeError) throw completeError;

      const { error: insertError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: job.job_id,
          job_table_name: 'production_jobs',
          category_id: job.category_id,
          production_stage_id: selectedPrintingStage,
          stage_order: 999,
          status: 'pending'
        });

      if (insertError) throw insertError;

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
      console.error('Error advancing to printing stage:', error);
      toast.error("Failed to advance to printing stage");
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
      if (hasProofBeenEmailed) {
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
              Mark as Approved & Advance
            </Button>

            {/* Show printing stage selection after proof is emailed */}
            <Label className="text-sm font-medium">Assigned Printing Stages:</Label>
            <div className="space-y-2">
              {existingPrintingStages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{stage.name}</div>
                    {stage.part_name && (
                      <div className="text-sm text-gray-500">Part: {stage.part_name}</div>
                    )}
                  </div>
                  <Select 
                    value={index === 0 ? selectedPrintingStage || stage.id : stage.id} 
                    onValueChange={(value) => {
                      if (index === 0) {
                        setSelectedPrintingStage(value);
                      }
                    }}
                    disabled={index !== 0}
                  >
                    <SelectTrigger className={cn(
                      "w-48",
                      index !== 0 && "opacity-50 cursor-not-allowed"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[60vh]">
                      {allPrintingStages.map((availableStage) => (
                        <SelectItem key={availableStage.id} value={availableStage.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: availableStage.color }}
                            />
                            {availableStage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        );
      } else {
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
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>DTP Workflow: {job.wo_no}</span>
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

        <div className="border-t pt-4 space-y-3">
          {currentStage === 'dtp' && renderDTPActions()}
          {currentStage === 'proof' && renderProofActions()}
          
          {currentStage === 'unknown' && (
            <div className="text-center text-gray-500">
              Stage not recognized or no actions available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
