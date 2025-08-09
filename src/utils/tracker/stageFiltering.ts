import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

/**
 * Unified stage filtering logic - used by both ProductionSidebar and TrackerProduction
 * to ensure consistent filtering behavior.
 */
export const filterJobsByStage = (jobs: AccessibleJob[], stageName: string): AccessibleJob[] => {
  console.log(`🔍 Filtering jobs by stage: "${stageName}"`, { totalJobs: jobs.length });
  
  const filteredJobs = jobs.filter(job => {
    // For virtual job entries, they already have current_stage_name set to their parallel stage
    if (job.is_virtual_stage_entry) {
      const matches = job.current_stage_name === stageName;
      console.log(`  Virtual job ${job.wo_no} (${job.current_stage_name}): ${matches ? '✅' : '❌'}`);
      return matches;
    }
    
    // For regular jobs, check current stage first
    const currentStage = job.current_stage_name || job.display_stage_name;
    
    // Check if job's current stage matches
    if (currentStage === stageName) {
      console.log(`  Regular job ${job.wo_no} matches by current stage: ✅`);
      return true;
    }
    
    // Check if job has current parallel stages that match
    if (job.parallel_stages && job.parallel_stages.length > 0) {
      // Calculate current stage order from parallel stages (same logic as getJobParallelStages)
      const activeStages = job.parallel_stages.filter(stage => 
        stage.stage_status === 'active' || stage.stage_status === 'pending'
      );
      
      if (activeStages.length > 0) {
        const currentOrder = Math.min(...activeStages.map(s => s.stage_order));
        const currentParallelStages = activeStages.filter(stage => 
          stage.stage_order === currentOrder
        );
        const matches = currentParallelStages.some(stage => stage.stage_name === stageName);
        
        if (matches) {
          console.log(`  Regular job ${job.wo_no} matches by parallel stage: ✅`);
          return true;
        }
      }
    }
    
    console.log(`  Job ${job.wo_no} (${currentStage}) does not match: ❌`);
    return false;
  });

  console.log(`🔍 Stage "${stageName}" filtering result: ${filteredJobs.length}/${jobs.length} jobs`);
  return filteredJobs;
};

/**
 * Count jobs for a specific stage - used by sidebar components
 */
export const getJobCountForStage = (jobs: AccessibleJob[], stageName: string): number => {
  return filterJobsByStage(jobs, stageName).length;
};