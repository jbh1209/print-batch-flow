
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Package, Scan } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { JobActionState, BarcodeJobAction } from "@/hooks/tracker/useBarcodeControlledActions";

interface DtpStageActionsProps {
  job: AccessibleJob;
  stageStatus: string;
  scanCompleted: boolean;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
  onRefresh?: () => void;
  onClose: () => void;
}

export const DtpStageActions: React.FC<DtpStageActionsProps> = ({
  job,
  stageStatus,
  scanCompleted,
  onStart,
  onComplete,
  onRefresh,
  onClose
}) => {
  const { user } = useAuth();

  const handleStartDTP = async () => {
    if (!scanCompleted) {
      toast.error('Scan the work order barcode first');
      return;
    }

    if (onStart && job.current_stage_id) {
      const success = await onStart(job.job_id, job.current_stage_id);
      if (success) {
        toast.success("DTP work started");
        onRefresh?.();
      }
    }
  };

  const handleCompleteDTP = async () => {
    if (!scanCompleted) {
      toast.error('Scan the work order barcode first');
      return;
    }

    if (onComplete && job.current_stage_id) {
      const success = await onComplete(job.job_id, job.current_stage_id);
      if (success) {
        toast.success("DTP completed - moved to Proof");
        onRefresh?.();
        onClose();
      }
    }
  };

  // Remove the batch function that used removed props
  // const handleSendToBatching = async () => {
  //   // Removed - function used props that no longer exist
  // };

  if (stageStatus === 'pending') {
    return (
      <div className="space-y-3">
        <Button 
          onClick={handleStartDTP}
          disabled={!scanCompleted}
          className={`w-full ${scanCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          <Play className="h-4 w-4 mr-2" />
          {scanCompleted ? "Start DTP Work" : "Scan Required First"}
        </Button>
      </div>
    );
  }

  if (stageStatus === 'active') {
    return (
      <div className="space-y-3">
        <Button 
          onClick={handleCompleteDTP}
          disabled={!scanCompleted}
          className={`w-full ${scanCompleted ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {scanCompleted ? "Complete DTP Work" : "Scan Required First"}
        </Button>
      </div>
    );
  }

  return null;
};
