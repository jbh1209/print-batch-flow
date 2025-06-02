
import { AccessCheckResult } from './types';

export const checkJobAccess = (
  job: any,
  accessibleStageIds: string[],
  accessibleStageNames: string[]
): AccessCheckResult => {
  console.log(`🔍 Processing job ${job.wo_no}:`, {
    status: job.status,
    currentStage: job.current_stage,
    hasWorkflow: job.has_workflow,
    stagesInfo: job.stages?.map((s: any) => ({
      name: s.stage_name || s.production_stages?.name,
      status: s.status,
      stageId: s.production_stage_id?.substring(0, 8)
    }))
  });

  // Step 1: Check workflow stage instances (with consolidated stage IDs)
  const hasAccessibleWorkflowStages = job.stages?.some((stage: any) => {
    const stageId = stage.production_stage_id || stage.stage_id;
    const stageName = stage.stage_name || stage.production_stages?.name;
    
    // ID-based check (using consolidated IDs)
    const hasIdAccess = stageId && accessibleStageIds.includes(stageId);
    
    // Name-based fallback (case-insensitive)
    const hasNameAccess = stageName && accessibleStageNames.includes(stageName.toLowerCase());
    
    // Stage must be active or pending to be workable
    const isWorkableStatus = ['active', 'pending'].includes(stage.status);
    
    const stageAccessible = (hasIdAccess || hasNameAccess) && isWorkableStatus;
    
    if (stageAccessible) {
      console.log(`  ✅ Stage accessible: ${stageName} (ID: ${stageId?.substring(0, 8)}, Status: ${stage.status})`);
    }
    
    return stageAccessible;
  }) || false;

  // Step 2: Check current stage by name for jobs with/without workflows
  const currentStageAccessible = job.current_stage && 
    accessibleStageNames.includes(job.current_stage.toLowerCase());

  // Step 3: Check status field for stage-based access
  const statusBasedAccess = job.status && 
    accessibleStageNames.includes(job.status.toLowerCase());

  // Step 4: Special handling for jobs without workflows
  const noWorkflowAccess = !job.has_workflow && (
    currentStageAccessible || 
    statusBasedAccess ||
    // Default access for DTP users on jobs with no specific stage
    (!job.current_stage && !job.status && accessibleStageNames.includes('dtp'))
  );

  // Combine all access checks
  const isAccessible = hasAccessibleWorkflowStages || 
                      currentStageAccessible || 
                      statusBasedAccess ||
                      noWorkflowAccess;

  const accessReasons = {
    hasAccessibleWorkflowStages,
    currentStageAccessible,
    statusBasedAccess,
    noWorkflowAccess
  };

  return { isAccessible, accessReasons };
};

export const isJobCompleted = (job: any): boolean => {
  return ['completed', 'shipped', 'delivered', 'cancelled', 'finished'].includes(
    job.status?.toLowerCase() || ''
  );
};
