import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Pause } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PrintingStageActionsProps {
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

export const PrintingStageActions: React.FC<PrintingStageActionsProps> = ({
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

  const handleStartPrinting = async () => {
    if (onStart && job.current_stage_id) {
      const success = await onStart(job.job_id, job.current_stage_id);
      if (success) {
        onJobStatusUpdate('Printing', 'active');
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
          status: 'Printing',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      onJobStatusUpdate('Printing', 'active');
      toast.success("Printing started");
      onRefresh?.();
    } catch (error) {
      console.error('Error starting printing:', error);
      toast.error("Failed to start printing");
    }
  };

  const handleCompletePrinting = async () => {
    if (onComplete && job.current_stage_id) {
      const success = await onComplete(job.job_id, job.current_stage_id);
      if (success) {
        onJobStatusUpdate('Print Complete', 'completed');
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
        p_notes: notes || 'Printing completed'
      });

      if (error) throw error;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Print Complete',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Printing completed");
      onJobStatusUpdate('Print Complete', 'completed');
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error completing printing:', error);
      toast.error("Failed to complete printing");
    }
  };

  const handleHoldJob = async () => {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'on_hold',
          updated_at: new Date().toISOString(),
          notes: notes || 'Job put on hold'
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (error) throw error;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'On Hold',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      onJobStatusUpdate('On Hold', 'on_hold');
      toast.success("Job put on hold");
      onRefresh?.();
    } catch (error) {
      console.error('Error putting job on hold:', error);
      toast.error("Failed to put job on hold");
    }
  };

  // Show appropriate buttons based on stage status
  if (stageStatus === 'pending') {
    return (
      <div className="space-y-2">
        <Button 
          onClick={handleStartPrinting}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Printing
        </Button>
      </div>
    );
  }

  if (stageStatus === 'active') {
    return (
      <div className="space-y-2">
        <Button 
          onClick={handleCompletePrinting}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete Printing
        </Button>
        
        <Button 
          onClick={handleHoldJob}
          disabled={isLoading}
          variant="outline"
          className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
        >
          <Pause className="h-4 w-4 mr-2" />
          Put on Hold
        </Button>
      </div>
    );
  }

  return null;
};