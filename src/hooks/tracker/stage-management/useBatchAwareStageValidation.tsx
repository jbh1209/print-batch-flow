import { useCallback, useMemo } from "react";

interface BatchJob {
  id: string;
  is_batch_master?: boolean;
  batch_name?: string;
  constituent_jobs_count?: number;
  batch_ready?: boolean;
}

interface StageWithBatchContext {
  id: string;
  status: string;
  stage_order: number;
  production_stage?: {
    name: string;
    is_conditional?: boolean;
  };
  job?: BatchJob;
}

/**
 * Enhanced stage validation with batch awareness
 * Provides validation logic for both individual jobs and batch master jobs
 */
export const useBatchAwareStageValidation = (jobStages: StageWithBatchContext[], job?: BatchJob) => {
  
  const canStartStage = useCallback((stageId: string) => {
    const stage = jobStages.find(s => s.id === stageId);
    if (!stage) return false;

    // Basic validation: stage must be pending
    if (stage.status !== 'pending') return false;

    // For batch master jobs, ensure constituent jobs are properly set up
    if (job?.is_batch_master) {
      // Batch masters can start any pending stage
      return true;
    }

    // For individual jobs that are batch ready, check if they should be in batch processing
    if (job?.batch_ready && !job?.is_batch_master) {
      // Individual jobs that are batch ready shouldn't start stages directly
      // They should be processed via batch
      return false;
    }

    return true;
  }, [jobStages, job]);

  const canAdvanceStage = useCallback((stageId: string) => {
    const stage = jobStages.find(s => s.id === stageId);
    if (!stage) return false;

    // Basic validation: stage must be active
    if (stage.status !== 'active') return false;

    // For batch master jobs, additional validation
    if (job?.is_batch_master) {
      // Ensure batch has constituent jobs
      if (!job.constituent_jobs_count || job.constituent_jobs_count === 0) {
        console.warn('⚠️ Batch master job has no constituent jobs');
        return false;
      }
      return true;
    }

    // For individual jobs in batch processing, they shouldn't advance directly
    if (job?.batch_ready && !job?.is_batch_master) {
      return false;
    }

    return true;
  }, [jobStages, job]);

  const canReworkStage = useCallback((stageId: string) => {
    const stage = jobStages.find(s => s.id === stageId);
    if (!stage) return false;

    // Basic validation: stage must be active
    if (stage.status !== 'active') return false;

    // For batch master jobs, rework affects the entire batch
    if (job?.is_batch_master) {
      return true;
    }

    // Individual jobs can be reworked if not in batch processing
    return !job?.batch_ready;
  }, [jobStages, job]);

  const getCurrentStage = useCallback(() => {
    return jobStages.find(stage => stage.status === 'active') || null;
  }, [jobStages]);

  const getNextStage = useCallback(() => {
    const currentStage = getCurrentStage();
    if (!currentStage) {
      // No active stage, return first pending stage
      return jobStages.find(stage => stage.status === 'pending') || null;
    }

    // Find next pending stage after current
    return jobStages.find(stage => 
      stage.status === 'pending' && 
      stage.stage_order > currentStage.stage_order
    ) || null;
  }, [jobStages, getCurrentStage]);

  const getAvailableReworkStages = useCallback((currentStageId: string) => {
    const currentStage = jobStages.find(s => s.production_stage?.name && s.id === currentStageId);
    if (!currentStage) return [];
    
    return jobStages.filter(stage => 
      stage.stage_order < currentStage.stage_order &&
      ['completed', 'reworked'].includes(stage.status)
    );
  }, [jobStages]);

  const getBatchContext = useMemo(() => {
    if (!job) return null;

    return {
      isBatchMaster: job.is_batch_master || false,
      batchName: job.batch_name || null,
      constituentCount: job.constituent_jobs_count || 0,
      isBatchReady: job.batch_ready || false,
      canProcessIndividually: !job.batch_ready && !job.is_batch_master
    };
  }, [job]);

  const getStageDisplayInfo = useCallback((stage: StageWithBatchContext) => {
    const batchContext = getBatchContext;
    
    let displayText = stage.production_stage?.name || 'Unknown Stage';
    let statusColor = 'gray';
    let isDisabled = false;

    // Determine status color
    switch (stage.status) {
      case 'active':
        statusColor = 'blue';
        break;
      case 'completed':
        statusColor = 'green';
        break;
      case 'pending':
        statusColor = 'yellow';
        break;
      case 'reworked':
        statusColor = 'orange';
        break;
      default:
        statusColor = 'gray';
    }

    // Add batch context to display
    if (batchContext?.isBatchMaster) {
      displayText += ` (Batch: ${batchContext.constituentCount} jobs)`;
    } else if (batchContext?.isBatchReady) {
      displayText += ' (Ready for Batch)';
      isDisabled = true; // Individual batch-ready jobs shouldn't be processed alone
    }

    return {
      displayText,
      statusColor,
      isDisabled,
      batchContext
    };
  }, [getBatchContext]);

  return {
    canStartStage,
    canAdvanceStage,
    canReworkStage,
    getCurrentStage,
    getNextStage,
    getAvailableReworkStages,
    getBatchContext,
    getStageDisplayInfo
  };
};