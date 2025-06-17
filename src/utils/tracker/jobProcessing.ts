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
 * Stage to Master Queue mapping based on database structure
 */
const STAGE_TO_MASTER_QUEUE_MAP: Record<string, string> = {
  // HP 12000 Master Queue stages
  'printing - 12000': 'hp12000',
  'printing - hp 12000': 'hp12000',
  'printing - 12000 - standard': 'hp12000',
  'printing - 12000 - multi part': 'hp12000',
  'hp 12000': 'hp12000',
  'hp12000': 'hp12000',
  '12000': 'hp12000',
  
  // HP 7900 Master Queue stages
  'printing - 7900': 'hp7900',
  'printing - hp 7900': 'hp7900',
  'printing - 7900 - standard': 'hp7900',
  'printing - 7900 - multi part': 'hp7900',
  'printing - hp 7900 - standard': 'hp7900',
  'printing - hp 7900 - multi part': 'hp7900',
  '7900 - standard': 'hp7900',
  '7900 - multi': 'hp7900',
  'hp 7900': 'hp7900',
  'hp7900': 'hp7900',
  '7900': 'hp7900',
  
  // HP T250 Master Queue stages
  'printing - t250': 'hpt250',
  'printing - hp t250': 'hpt250',
  'printing - t250 - multi part': 'hpt250',
  'printing - hp t250 - multi part': 'hpt250',
  'hp t250': 'hpt250',
  'hpt250': 'hpt250',
  't250': 'hpt250',
  't 250': 'hpt250',
};

/**
 * Get master queue category from stage name - now uses display_stage_name first
 */
const getMasterQueueCategory = (job: AccessibleJob): string | null => {
  // Use display_stage_name first (for master queue consolidation), fallback to current_stage_name
  const stageName = job.display_stage_name || job.current_stage_name || '';
  
  if (!stageName) return null;
  
  const normalizedStage = stageName.toLowerCase().trim();
  
  // Direct mapping lookup
  if (STAGE_TO_MASTER_QUEUE_MAP[normalizedStage]) {
    return STAGE_TO_MASTER_QUEUE_MAP[normalizedStage];
  }
  
  // Fallback pattern matching for variations
  if (normalizedStage.includes('12000')) return 'hp12000';
  if (normalizedStage.includes('7900')) return 'hp7900';
  if (normalizedStage.includes('t250') || normalizedStage.includes('t 250')) return 'hpt250';
  
  return null;
};

/**
 * Enhanced job categorization that properly handles master queue consolidation
 * and groups jobs by their master queue assignments using display_stage_name
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

  console.log('🔍 Starting job categorization with enhanced master queue logic:', jobs.length, 'jobs');
  
  // Debug: Log all unique stage names
  const uniqueDisplayStages = new Set<string>();
  const uniqueCurrentStages = new Set<string>();
  jobs.forEach(job => {
    if (job.display_stage_name) uniqueDisplayStages.add(job.display_stage_name);
    if (job.current_stage_name) uniqueCurrentStages.add(job.current_stage_name);
  });
  console.log('📋 Unique display stage names found:', Array.from(uniqueDisplayStages).sort());
  console.log('📋 Unique current stage names found:', Array.from(uniqueCurrentStages).sort());

  jobs.forEach(job => {
    const effectiveStageName = (job.display_stage_name || job.current_stage_name || '').toLowerCase();
    
    console.log('🏷️ Processing job:', job.wo_no, {
      current_stage: job.current_stage_name,
      display_stage: job.display_stage_name,
      effective_stage: effectiveStageName
    });
    
    // Check for master queue assignment first using enhanced logic
    const masterQueueCategory = getMasterQueueCategory(job);
    
    if (masterQueueCategory) {
      console.log('📍 Master queue detected for job:', job.wo_no, '→', masterQueueCategory);
      
      switch (masterQueueCategory) {
        case 'hp12000':
          categorized.hp12000Jobs.push(job);
          console.log('✅ Added to HP 12000:', job.wo_no);
          break;
        case 'hp7900':
          categorized.hp7900Jobs.push(job);
          console.log('✅ Added to HP 7900:', job.wo_no);
          break;
        case 'hpt250':
          categorized.hpT250Jobs.push(job);
          console.log('✅ Added to HP T250:', job.wo_no);
          break;
      }
    } else {
      // Non-printing stage categorization
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
        // Generic printing jobs that don't match specific master queues
        categorized.otherJobs.push(job);
        console.log('🖨️ Added to Other Print:', job.wo_no);
      } else {
        categorized.otherJobs.push(job);
        console.log('❓ Added to Other:', job.wo_no);
      }
    }
  });

  const results = {
    dtp: categorized.dtpJobs.length,
    proof: categorized.proofJobs.length,
    hp12000: categorized.hp12000Jobs.length,
    hp7900: categorized.hp7900Jobs.length,
    hpT250: categorized.hpT250Jobs.length,
    finishing: categorized.finishingJobs.length,
    other: categorized.otherJobs.length
  };

  console.log('📊 Enhanced Master Queue Categorization Results:', results);
  console.log('🎯 Total jobs categorized:', Object.values(results).reduce((a, b) => a + b, 0));
  
  // Enhanced debugging for missing jobs in master queues
  if (categorized.hp7900Jobs.length === 0) {
    console.log('⚠️ NO HP 7900 JOBS FOUND! Analyzing all jobs with display_stage_name:');
    jobs.forEach(job => {
      const allStageVariants = [
        job.display_stage_name,
        job.current_stage_name
      ].filter(Boolean);
      
      allStageVariants.forEach(stage => {
        if (stage && stage.toLowerCase().includes('7900')) {
          console.log('🔍 Found potential HP 7900 job not categorized:', {
            wo_no: job.wo_no,
            stage_name: stage,
            normalized: stage.toLowerCase(),
            master_queue_result: getMasterQueueCategory(job)
          });
        }
      });
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
