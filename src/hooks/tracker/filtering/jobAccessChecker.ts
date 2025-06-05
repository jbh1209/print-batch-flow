
import { AccessCheckResult } from './types';

/**
 * Determines if a user has access to a job based on their accessible stage IDs and names
 * 
 * @param job The job object to check access for
 * @param accessibleStageIds Array of stage IDs the user has access to
 * @param accessibleStageNames Array of stage names (lowercase) the user has access to
 * @returns Object with boolean indicating if job is accessible and reasons for the decision
 */
export const checkJobAccess = (
  job: any,
  accessibleStageIds: string[],
  accessibleStageNames: string[]
): AccessCheckResult => {
  console.log(`🔍 Processing job ${job.wo_no}:`, {
    status: job.status,
    currentStage: job.current_stage_name,
    hasWorkflow: Boolean(job.current_stage_id),
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
    const hasNameAccess = stageName && accessibleStageNames.some(name => 
      stageName.toLowerCase().includes(name)
    );
    
    // Stage must be active or pending to be workable
    const isWorkableStatus = ['active', 'pending'].includes(stage.status);
    
    const stageAccessible = (hasIdAccess || hasNameAccess) && isWorkableStatus;
    
    if (stageAccessible) {
      console.log(`  ✅ Stage accessible: ${stageName} (ID: ${stageId?.substring(0, 8)}, Status: ${stage.status})`);
    }
    
    return stageAccessible;
  }) || false;

  // Step 2: Check current stage by name for jobs with/without workflows (ENHANCED)
  const currentStageAccessible = job.current_stage_name && 
    accessibleStageNames.some(name => 
      job.current_stage_name.toLowerCase().includes(name)
    );

  // Step 3: Check status field for stage-based access
  const statusBasedAccess = job.status && 
    accessibleStageNames.some(name => 
      job.status.toLowerCase().includes(name)
    );

  // Step 4: ENHANCED - Special handling for jobs without workflows
  const noWorkflowAccess = !job.current_stage_id && (
    currentStageAccessible || 
    statusBasedAccess ||
    // Default access for DTP users on jobs with no specific stage
    (!job.current_stage_name && !job.status && accessibleStageNames.includes('dtp')) ||
    // Fallback for jobs with generic statuses that should be accessible to DTP
    ((job.status?.toLowerCase() === 'pre-press' || job.status?.toLowerCase() === 'new') && 
      accessibleStageNames.some(name => ['dtp', 'design', 'artwork', 'proof'].includes(name)))
  );

  // Step 5: Special DTP filter - For DTP operators, ensure job is DTP related
  // This check applies if the user only has DTP stage access
  const isDtpOnlyUser = accessibleStageNames.every(name => 
    ['dtp', 'proof', 'digital', 'design', 'artwork', 'pre-press'].some(dtpTerm => 
      name.includes(dtpTerm))
  ) && accessibleStageNames.length > 0;

  // If user is DTP-only, ensure job has DTP-related stage or status
  const dtpSpecificAccess = isDtpOnlyUser ? (
    (job.current_stage_name && ['dtp', 'proof', 'digital', 'design', 'artwork', 'pre-press'].some(term => 
      job.current_stage_name.toLowerCase().includes(term))) ||
    (job.status && ['dtp', 'proof', 'digital', 'design', 'artwork', 'pre-press'].some(term => 
      job.status.toLowerCase().includes(term)))
  ) : true; // If not DTP-only user, this check is always true

  // Combine all access checks
  const isAccessible = (hasAccessibleWorkflowStages || 
                      currentStageAccessible || 
                      statusBasedAccess ||
                      noWorkflowAccess) && 
                      dtpSpecificAccess;

  const accessReasons = {
    hasAccessibleWorkflowStages,
    currentStageAccessible,
    statusBasedAccess,
    noWorkflowAccess,
    dtpSpecificAccess,
    isDtpOnlyUser
  };

  console.log(`  🎯 Access check result for ${job.wo_no}:`, {
    isAccessible,
    accessReasons,
    currentStage: job.current_stage_name,
    userStageNames: accessibleStageNames
  });

  return { isAccessible, accessReasons: accessReasons };
};

/**
 * Determines if a job has been completed
 * 
 * @param job The job object to check
 * @returns Boolean indicating if the job is completed
 */
export const isJobCompleted = (job: any): boolean => {
  return ['completed', 'shipped', 'delivered', 'cancelled', 'finished'].includes(
    job.status?.toLowerCase() || ''
  );
};
