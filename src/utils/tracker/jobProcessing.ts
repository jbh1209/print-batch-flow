
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

export interface CategorizedJobs {
  dtpJobs: AccessibleJob[];
  proofJobs: AccessibleJob[];
  hp12000Jobs: AccessibleJob[];
  hp7900Jobs: AccessibleJob[];
  hpT250Jobs: AccessibleJob[];
  finishingJobs: AccessibleJob[];
  otherJobs: AccessibleJob[];
}

/**
 * Enhanced job categorization that properly handles master queue consolidation
 * and splits printing jobs by specific queue types
 */
export const categorizeJobs = (jobs: AccessibleJob[]): CategorizedJobs => {
  const categorized: CategorizedJobs = {
    dtpJobs: [],
    proofJobs: [],
    hp12000Jobs: [],
    hp7900Jobs: [],
    hpT250Jobs: [],
    finishingJobs: [],
    otherJobs: []
  };

  jobs.forEach(job => {
    const stageName = (job.current_stage_name || '').toLowerCase();
    const displayStageName = (job.display_stage_name || '').toLowerCase();
    
    // Use display stage name if available (for master queue consolidation)
    const effectiveStageName = displayStageName || stageName;
    
    // Enhanced categorization logic that handles master queues and splits by printer type
    if (effectiveStageName.includes('dtp') || 
        effectiveStageName.includes('digital') ||
        effectiveStageName.includes('design') ||
        effectiveStageName.includes('artwork') ||
        effectiveStageName.includes('prepress') ||
        effectiveStageName.includes('pre-press')) {
      categorized.dtpJobs.push(job);
    } else if (effectiveStageName.includes('proof') ||
               effectiveStageName.includes('approval') ||
               effectiveStageName.includes('review')) {
      categorized.proofJobs.push(job);
    } else if (effectiveStageName.includes('12000') || 
               effectiveStageName.includes('hp 12000')) {
      categorized.hp12000Jobs.push(job);
    } else if (effectiveStageName.includes('7900') || 
               effectiveStageName.includes('hp 7900')) {
      categorized.hp7900Jobs.push(job);
    } else if (effectiveStageName.includes('t250') || 
               effectiveStageName.includes('hp t250')) {
      categorized.hpT250Jobs.push(job);
    } else if (effectiveStageName.includes('print') ||
               effectiveStageName.includes('hp') ||
               effectiveStageName.includes('press')) {
      // Generic printing jobs that don't match specific queues
      categorized.otherJobs.push(job);
    } else if (effectiveStageName.includes('finish') ||
               effectiveStageName.includes('cutting') ||
               effectiveStageName.includes('lamination') ||
               effectiveStageName.includes('binding') ||
               effectiveStageName.includes('folding')) {
      categorized.finishingJobs.push(job);
    } else {
      categorized.otherJobs.push(job);
    }
  });

  return categorized;
};

/**
 * Get jobs by category type
 */
export const getJobsByCategory = (jobs: AccessibleJob[], category: keyof CategorizedJobs): AccessibleJob[] => {
  const categorized = categorizeJobs(jobs);
  return categorized[category];
};

/**
 * Enhanced sorting for jobs by WO number with proper numerical sorting
 */
export const sortJobsByWONumber = (jobs: AccessibleJob[]): AccessibleJob[] => {
  return [...jobs].sort((a, b) => {
    const woA = a.wo_no || '';
    const woB = b.wo_no || '';
    
    // Extract numeric parts for proper sorting
    const numA = parseInt(woA.replace(/\D/g, '')) || 0;
    const numB = parseInt(woB.replace(/\D/g, '')) || 0;
    
    if (numA !== numB) {
      return numA - numB;
    }
    
    // Fallback to string comparison
    return woA.localeCompare(woB);
  });
};

/**
 * Filter jobs by master queue or individual stage
 */
export const filterJobsByStage = (jobs: AccessibleJob[], stageId: string): AccessibleJob[] => {
  return jobs.filter(job => {
    // Check if the job's current stage matches the filter
    return job.current_stage_id === stageId;
  });
};

/**
 * Get unique stage names from jobs (for debugging/display purposes)
 */
export const getUniqueStageNames = (jobs: AccessibleJob[]): string[] => {
  const stageNames = new Set<string>();
  
  jobs.forEach(job => {
    if (job.current_stage_name) {
      stageNames.add(job.current_stage_name);
    }
    if (job.display_stage_name) {
      stageNames.add(job.display_stage_name);
    }
  });
  
  return Array.from(stageNames).sort();
};
