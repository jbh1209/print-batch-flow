
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Package } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DtpStageActionsProps {
  job: AccessibleJob;
  stageStatus: string;
  notes: string;
  isLoading: boolean;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
  onRefresh?: () => void;
  onClose: () => void;
  onJobStatusUpdate: (status: string, stageStatus: string) => void;
}

export const DtpStageActions: React.FC<DtpStageActionsProps> = ({
  job,
  stageStatus,
  notes,
  isLoading,
  onStart,
  onComplete,
  onRefresh,
  onClose,
  onJobStatusUpdate
}) => {
  const { user } = useAuth();

  const handleStartDTP = async () => {
    if (onStart && job.current_stage_id) {
      const success = await onStart(job.job_id, job.current_stage_id);
      if (success) {
        onJobStatusUpdate('In Progress', 'active');
        onRefresh?.();
      }
      return;
    }

    // Fallback to direct database call
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

      onJobStatusUpdate('In Progress', 'active');
      toast.success("DTP work started");
      onRefresh?.();
    } catch (error) {
      console.error('Error starting DTP:', error);
      toast.error("Failed to start DTP work");
    }
  };

  const handleCompleteDTP = async () => {
    if (onComplete && job.current_stage_id) {
      const success = await onComplete(job.job_id, job.current_stage_id);
      if (success) {
        onJobStatusUpdate('Ready for Proof', 'completed');
        onRefresh?.();
        onClose();
      }
      return;
    }

    // Fallback to direct database call
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
      onJobStatusUpdate('Ready for Proof', 'completed');
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error completing DTP:', error);
      toast.error("Failed to complete DTP work");
    }
  };

  const handleSendToBatching = async () => {
    try {
      // Complete current DTP stage and mark job as ready for batching
      const { error: stageError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: notes || 'DTP completed - ready for batch allocation'
      });

      if (stageError) throw stageError;

      // Update job status to batch allocation
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Batch Allocation',
          batch_ready: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Job sent to batch allocation");
      onJobStatusUpdate('Batch Allocation', 'completed');
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error sending to batching:', error);
      toast.error("Failed to send job to batching");
    }
  };

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
      <div className="space-y-2">
        <Button 
          onClick={handleCompleteDTP}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete DTP (to Proof)
        </Button>
        
        <Button 
          onClick={handleSendToBatching}
          disabled={isLoading}
          variant="outline"
          className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
        >
          <Package className="h-4 w-4 mr-2" />
          Send to Batching
        </Button>
      </div>
    );
  }

  return null;
};
