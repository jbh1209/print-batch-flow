import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import type { ConsolidatedStage } from "@/utils/tracker/stageConsolidation";
import type { StageContext } from "@/hooks/tracker/useStageContextFiltering";

/**
 * Apply context-aware job filtering to show only jobs relevant to user's role
 * This prevents operators from seeing jobs from other departments
 */
export const applyContextJobFiltering = (
  jobs: AccessibleJob[],
  userContext: StageContext,
  availableStages: ConsolidatedStage[]
): AccessibleJob[] => {
  if (!jobs || jobs.length === 0) {
    console.log('⚠️ No jobs to filter');
    return [];
  }

  console.log('🎯 Applying context job filtering:', {
    totalJobs: jobs.length,
    userContext,
    availableStages: availableStages.length
  });

  // Create a set of stage IDs that the user has access to
  const accessibleStageIds = new Set<string>();
  const accessibleStageNames = new Set<string>();
  
  availableStages.forEach(stage => {
    accessibleStageIds.add(stage.stage_id);
    accessibleStageNames.add(stage.stage_name.toLowerCase());
    
    // Also add subsidiary stage IDs for master queues
    stage.subsidiary_stages.forEach(subStage => {
      accessibleStageIds.add(subStage.stage_id);
      accessibleStageNames.add(subStage.stage_name.toLowerCase());
    });
  });

  console.log('📋 User has access to stage names:', Array.from(accessibleStageNames).sort());

  const filtered = jobs.filter(job => {
    // Check if job's stage matches user's accessible stages
    const currentStageId = job.current_stage_id;
    const currentStageName = (job.current_stage_name || '').toLowerCase();
    const displayStageName = (job.display_stage_name || '').toLowerCase();
    
    // Direct stage ID match (most reliable)
    if (currentStageId && accessibleStageIds.has(currentStageId)) {
      return true;
    }

    // Stage name match (fallback)
    const hasStageNameMatch = accessibleStageNames.has(currentStageName) || 
                              accessibleStageNames.has(displayStageName);
    
    if (hasStageNameMatch) {
      return true;
    }

    // Context-specific pattern matching for edge cases
    return isJobRelevantForContext(job, userContext, accessibleStageNames);
  });

  console.log('✅ Context filtering complete:', {
    originalJobs: jobs.length,
    filteredJobs: filtered.length,
    userContext,
    removedJobs: jobs.length - filtered.length
  });

  // Log removed jobs for debugging
  const removedJobs = jobs.filter(job => !filtered.includes(job));
  if (removedJobs.length > 0) {
    console.log('🚫 Jobs filtered out:', removedJobs.map(job => ({
      wo_no: job.wo_no,
      current_stage: job.current_stage_name,
      display_stage: job.display_stage_name,
      stage_id: job.current_stage_id
    })));
  }

  return filtered;
};

/**
 * Check if a job is relevant for the user's context using pattern matching
 */
const isJobRelevantForContext = (
  job: AccessibleJob,
  userContext: StageContext,
  accessibleStageNames: Set<string>
): boolean => {
  const currentStageName = (job.current_stage_name || '').toLowerCase();
  const displayStageName = (job.display_stage_name || '').toLowerCase();
  const effectiveStageName = displayStageName || currentStageName;

  switch (userContext) {
    case 'printing':
      // Printing operators should only see printing-related jobs
      return effectiveStageName.includes('printing') ||
             effectiveStageName.includes('hp') ||
             effectiveStageName.includes('12000') ||
             effectiveStageName.includes('7900') ||
             effectiveStageName.includes('t250');

    case 'dtp':
      // DTP operators should see DTP and proofing jobs
      return effectiveStageName.includes('dtp') ||
             effectiveStageName.includes('design') ||
             effectiveStageName.includes('prepress') ||
             effectiveStageName.includes('artwork') ||
             effectiveStageName.includes('proof') ||
             effectiveStageName.includes('approval');

    case 'batch_allocation':
      // Batch operators should only see batch allocation jobs
      return effectiveStageName.includes('batch') ||
             effectiveStageName.includes('allocation');

    case 'finishing':
      // Finishing operators should only see finishing jobs
      return effectiveStageName.includes('finish') ||
             effectiveStageName.includes('cutting') ||
             effectiveStageName.includes('lamination') ||
             effectiveStageName.includes('binding') ||
             effectiveStageName.includes('folding');

    case 'admin':
      // Admins can see everything
      return true;

    default:
      return false;
  }
};

/**
 * Get the context-appropriate display name for a job's stage
 */
export const getContextStageDisplayName = (
  job: AccessibleJob,
  userContext: StageContext,
  availableStages: ConsolidatedStage[]
): string => {
  const currentStageId = job.current_stage_id;
  
  // Find the stage in available stages
  const stage = availableStages.find(s => s.stage_id === currentStageId);
  if (stage) {
    return stage.stage_name;
  }

  // Find in subsidiary stages
  for (const stage of availableStages) {
    const subStage = stage.subsidiary_stages.find(sub => sub.stage_id === currentStageId);
    if (subStage) {
      // For printing context, show master queue name
      if (userContext === 'printing' && stage.is_master_queue) {
        return stage.stage_name;
      }
      return subStage.stage_name;
    }
  }

  // Fallback to original display name
  return job.display_stage_name || job.current_stage_name || 'Unknown Stage';
};