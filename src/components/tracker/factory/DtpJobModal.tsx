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
import { WorkInstructionsCard } from "./WorkInstructionsCard";
import { JobNotesCard } from "./JobNotesCard";
import { Play, CheckCircle, Mail, ThumbsUp, Printer } from "lucide-react";
import { getJobStatusBadgeInfo } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DtpJobModalProps {
  job: AccessibleJob;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
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
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [printers, setPrinters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const statusBadgeInfo = getJobStatusBadgeInfo(job);

  // Load printers when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const loadPrinters = async () => {
        const { data } = await supabase
          .from('printers')
          .select('*')
          .eq('status', 'active')
          .order('name');
        
        if (data) {
          setPrinters(data);
        }
      };
      loadPrinters();
    }
  }, [isOpen]);

  const getCurrentStage = () => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    if (stageName.includes('dtp')) return 'dtp';
    if (stageName.includes('proof')) return 'proof';
    return 'unknown';
  };

  const getStageStatus = () => {
    return job.current_stage_status || 'pending';
  };

  const currentStage = getCurrentStage();
  const stageStatus = getStageStatus();

  const handleStartDTP = async () => {
    if (onStart && job.current_stage_id) {
      const success = await onStart(job.job_id, job.current_stage_id);
      if (success) {
        onRefresh?.();
        onClose();
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

      toast.success("DTP work started");
      onRefresh?.();
      onClose();
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
      toast.error("Failed to start proof stage");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProofEmailed = async () => {
    setIsLoading(true);
    try {
      const { error: proofError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (proofError) throw proofError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Awaiting Client Sign Off',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

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
      const { error: approveError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_approved_manually_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (approveError) throw approveError;

      const { error: advanceError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: notes || 'Proof approved by client'
      });

      if (advanceError) throw advanceError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Approved - Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Proof approved - ready for printing");
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error approving proof:', error);
      toast.error("Failed to approve proof");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrinterSelection = async () => {
    if (!selectedPrinter) {
      toast.error("Please select a printer");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          printer_id: selectedPrinter,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (error) throw error;

      toast.success("Printer assigned successfully");
      onRefresh?.();
    } catch (error) {
      console.error('Error assigning printer:', error);
      toast.error("Failed to assign printer");
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
      return (
        <div className="space-y-3">
          <Button 
            onClick={handleProofEmailed}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Proof Emailed
          </Button>
          
          <Button 
            onClick={handleProofApproved}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Proof Approved
          </Button>

          <div className="space-y-2">
            <Label>Select Printer for Production:</Label>
            <div className="flex gap-2">
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose printer..." />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name} ({printer.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handlePrinterSelection}
                disabled={!selectedPrinter || isLoading}
                size="sm"
              >
                <Printer className="h-4 w-4 mr-1" />
                Assign
              </Button>
            </div>
          </div>
        </div>
      );
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
          <CurrentStageCard job={job} statusInfo={statusBadgeInfo} />
          <WorkInstructionsCard job={job} />
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
