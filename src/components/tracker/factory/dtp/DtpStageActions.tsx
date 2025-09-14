
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Package, Scan } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { JobActionState, BarcodeJobAction } from "@/hooks/tracker/useBarcodeControlledActions";
import { completeJobStage } from "@/hooks/tracker/useAccessibleJobs/utils/jobCompletionUtils";

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
  onStartWithBarcode?: () => Promise<void>;
  onCompleteWithBarcode?: () => Promise<void>;
  barcodeActionState?: JobActionState;
  currentBarcodeAction?: BarcodeJobAction | null;
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
  onJobStatusUpdate,
  onStartWithBarcode,
  onCompleteWithBarcode,
  barcodeActionState,
  currentBarcodeAction
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

    // Fallback using safe helper (no duplicate toasts)
    try {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { startJobStage } = await import('@/hooks/tracker/useAccessibleJobs/utils/jobCompletionUtils');
      const success = await startJobStage(job.job_id, job.current_stage_id, user.id, 'production_jobs');
      
      if (success) {
        const { error: jobError } = await supabase
          .from('production_jobs')
          .update({
            status: 'In Progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.job_id);

        if (jobError) throw jobError;

        onJobStatusUpdate('In Progress', 'active');
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error starting DTP:', error);
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

    // Fallback to safe helper (no duplicate toasts)
    try {
      const { completeJobStage } = await import('@/hooks/tracker/useAccessibleJobs/utils/jobCompletionUtils');
      const success = job.current_stage_id
        ? await completeJobStage(job.job_id, job.current_stage_id, 'production_jobs', 'DTP work completed')
        : false;

      if (success) {
        const { error: jobError } = await supabase
          .from('production_jobs')
          .update({
            status: 'Ready for Proof',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.job_id);

        if (jobError) throw jobError;

        onJobStatusUpdate('Ready for Proof', 'completed');
        onRefresh?.();
        onClose();
      }
    } catch (error: any) {
      console.error('Error completing DTP:', error);
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

  // Show scanning state if barcode action is in progress
  const isScanning = barcodeActionState === 'scanning';
  const isBarcodeProcessing = barcodeActionState === 'working' || barcodeActionState === 'completing';

  if (stageStatus === 'pending') {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-1">
            Barcode Required - Work Order: {job.wo_no}
          </p>
          <p className="text-xs text-blue-600">
            Scan the barcode sticker on your work order to start this job
          </p>
        </div>
        
        {/* Mandatory barcode scan button for starting */}
        <Button 
          onClick={onStartWithBarcode}
          disabled={isLoading || isBarcodeProcessing || !onStartWithBarcode}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {isScanning ? (
            <>
              <Scan className="h-4 w-4 mr-2 animate-pulse" />
              Scanning Barcode...
            </>
          ) : (
            <>
              <Scan className="h-4 w-4 mr-2" />
              Scan Barcode to Start
            </>
          )}
        </Button>
      </div>
    );
  }

  if (stageStatus === 'active') {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800 font-medium mb-1">
            Barcode Required - Work Order: {job.wo_no}
          </p>
          <p className="text-xs text-orange-600">
            Scan the barcode sticker on your work order to complete this job
          </p>
        </div>
        
        {/* Mandatory barcode scan button for completion */}
        <Button 
          onClick={onCompleteWithBarcode}
          disabled={isLoading || isBarcodeProcessing || !onCompleteWithBarcode}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isScanning && barcodeActionState === 'scanning' ? (
            <>
              <Scan className="h-4 w-4 mr-2 animate-pulse" />
              Scanning Barcode...
            </>
          ) : (
            <>
              <Scan className="h-4 w-4 mr-2" />
              Scan Barcode to Complete
            </>
          )}
        </Button>
        
        <Button 
          onClick={handleSendToBatching}
          disabled={isLoading || isBarcodeProcessing}
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
