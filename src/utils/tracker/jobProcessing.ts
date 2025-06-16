
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

  console.log('🔍 Categorizing jobs:', jobs.length);
  console.log('📋 Raw jobs data:', jobs.map(job => ({
    wo_no: job.wo_no,
    current_stage_name: job.current_stage_name,
    display_stage_name: job.display_stage_name
  })));

  jobs.forEach(job => {
    const stageName = (job.current_stage_name || '').toLowerCase();
    const displayStageName = (job.display_stage_name || '').toLowerCase();
    
    // Use display stage name if available (for master queue consolidation)
    const effectiveStageName = displayStageName || stageName;
    
    console.log('🏷️ Job:', job.wo_no, 'Stage:', effectiveStageName, 'Original:', stageName, 'Display:', displayStageName);
    
    // Enhanced categorization logic with comprehensive pattern matching
    if (effectiveStageName.includes('dtp') || 
        effectiveStageName.includes('digital') ||
        effectiveStageName.includes('design') ||
        effectiveStageName.includes('artwork') ||
        effectiveStageName.includes('prepress') ||
        effectiveStageName.includes('pre-press')) {
      categorized.dtpJobs.push(job);
      console.log('📝 Added to DTP:', job.wo_no);
    } else if (effectiveStageName.includes('proof') ||
               effectiveStageName.includes('approval') ||
               effectiveStageName.includes('review')) {
      categorized.proofJobs.push(job);
      console.log('🔍 Added to Proof:', job.wo_no);
    } else if (effectiveStageName.includes('12000') || 
               effectiveStageName.includes('hp 12000') ||
               effectiveStageName.includes('hp12000') ||
               effectiveStageName.includes('printing - 12000') ||
               effectiveStageName.includes('printing - hp 12000')) {
      categorized.hp12000Jobs.push(job);
      console.log('🖨️ Added to HP 12000:', job.wo_no);
    } else if (effectiveStageName.includes('7900') || 
               effectiveStageName.includes('hp 7900') ||
               effectiveStageName.includes('hp7900') ||
               effectiveStageName.includes('printing - 7900') ||
               effectiveStageName.includes('printing - hp 7900') ||
               effectiveStageName.includes('7900 - standard') ||
               effectiveStageName.includes('7900 - multi')) {
      categorized.hp7900Jobs.push(job);
      console.log('🖨️ Added to HP 7900:', job.wo_no);
    } else if (effectiveStageName.includes('t250') || 
               effectiveStageName.includes('hp t250') ||
               effectiveStageName.includes('hpt250') ||
               effectiveStageName.includes('t 250') ||
               effectiveStageName.includes('printing - t250') ||
               effectiveStageName.includes('printing - hp t250')) {
      categorized.hpT250Jobs.push(job);
      console.log('🖨️ Added to HP T250:', job.wo_no);
    } else if (effectiveStageName.includes('finish') ||
               effectiveStageName.includes('cutting') ||
               effectiveStageName.includes('lamination') ||
               effectiveStageName.includes('binding') ||
               effectiveStageName.includes('folding')) {
      categorized.finishingJobs.push(job);
      console.log('✂️ Added to Finishing:', job.wo_no);
    } else if (effectiveStageName.includes('print') ||
               effectiveStageName.includes('hp') ||
               effectiveStageName.includes('press')) {
      // Generic printing jobs that don't match specific queues
      categorized.otherJobs.push(job);
      console.log('🖨️ Added to Other Print:', job.wo_no);
    } else {
      categorized.otherJobs.push(job);
      console.log('❓ Added to Other:', job.wo_no);
    }
  });

  console.log('📊 Final categorization results:', {
    dtp: categorized.dtpJobs.length,
    proof: categorized.proofJobs.length,
    hp12000: categorized.hp12000Jobs.length,
    hp7900: categorized.hp7900Jobs.length,
    hpT250: categorized.hpT250Jobs.length,
    finishing: categorized.finishingJobs.length,
    other: categorized.otherJobs.length
  });

  // Additional debugging for HP 7900 specifically
  if (categorized.hp7900Jobs.length === 0) {
    console.log('⚠️ NO HP 7900 JOBS FOUND! Checking all stage names:');
    jobs.forEach(job => {
      const effectiveName = (job.display_stage_name || job.current_stage_name || '').toLowerCase();
      if (effectiveName.includes('7900')) {
        console.log('🔍 Found potential HP 7900 job:', job.wo_no, 'Stage:', effectiveName);
      }
    });
  }

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
