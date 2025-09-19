
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface StageInstance {
  id: string;
  status: string;
  proof_emailed_at?: string;
  proof_approved_manually_at?: string;
  client_email?: string;
  client_name?: string;
}

type ProofApprovalFlow = 'pending' | 'choosing_allocation' | 'batch_allocation' | 'direct_printing';

export const useDtpJobModal = (job: AccessibleJob, isOpen: boolean) => {
  const [stageInstance, setStageInstance] = useState<StageInstance | null>(null);
  const [proofApprovalFlow, setProofApprovalFlow] = useState<ProofApprovalFlow>('pending');
  const [selectedBatchCategory, setSelectedBatchCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentStage = useCallback(() => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    if (stageName.includes('dtp')) return 'dtp';
    if (stageName.includes('proof')) return 'proof';
    return 'unknown';
  }, [job.current_stage_name]);

  const getStageStatus = useCallback(() => {
    return job.current_stage_status || 'pending';
  }, [job.current_stage_status]);

  const loadModalData = useCallback(async () => {
    if (!isOpen) return;

    // Reset batch category selection
    setSelectedBatchCategory("");

    // Load current stage instance data
    if (job.current_stage_id) {
      const { data: stageData } = await supabase
        .from('job_stage_instances')
        .select('id, status, proof_emailed_at, proof_approved_manually_at, client_email, client_name')
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id)
        .single();

      setStageInstance(stageData || null);

      // Initialize proofApprovalFlow based on the actual database state
      if (stageData?.proof_approved_manually_at) {
        // If proof has been approved, show the allocation options
        setProofApprovalFlow('choosing_allocation');
      } else {
        // If proof hasn't been approved yet, start with pending flow
        setProofApprovalFlow('pending');
      }
    } else {
      setStageInstance(null);
      setProofApprovalFlow('pending');
    }
  }, [isOpen, job.current_stage_id, job.job_id]);

  useEffect(() => {
    if (isOpen) {
      loadModalData();
    }
  }, [isOpen, loadModalData]);

  return {
    stageInstance,
    proofApprovalFlow,
    selectedBatchCategory,
    isLoading,
    getCurrentStage,
    getStageStatus,
    loadModalData,
    setStageInstance,
    setProofApprovalFlow,
    setSelectedBatchCategory,
    setIsLoading
  };
};
