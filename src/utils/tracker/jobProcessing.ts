
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
 * Enhanced stage to Master Queue mapping - more comprehensive and case-insensitive
 */
const STAGE_TO_MASTER_QUEUE_MAP: Record<string, string> = {
  // HP 12000 Master Queue stages - ALL VARIATIONS
  'printing - 12000': 'hp12000',
  'printing - hp 12000': 'hp12000',
  'printing - 12000 - standard': 'hp12000',
  'printing - 12000 - multi part': 'hp12000',
  'printing - hp 12000 - standard': 'hp12000',
  'printing - hp 12000 - multi part': 'hp12000',
  'hp 12000': 'hp12000',
  'hp12000': 'hp12000',
  '12000': 'hp12000',
  
  // HP 7900 Master Queue stages - ALL VARIATIONS
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
  
  // HP T250 Master Queue stages - ALL VARIATIONS
  'printing - t250': 'hpt250',
  'printing - hp t250': 'hpt250',
  'printing - t250 - multi part': 'hpt250',
  'printing - hp t250 - multi part': 'hpt250',
  'printing - t250 - standard': 'hpt250',
  'printing - hp t250 - standard': 'hpt250',
  'hp t250': 'hpt250',
  'hpt250': 'hpt250',
  't250': 'hpt250',
  't 250': 'hpt250',
};

/**
 * Enhanced master queue category detection with robust pattern matching
 */
const getMasterQueueCategory = (job: AccessibleJob): string | null => {
  // Use display_stage_name first (for master queue consolidation), fallback to current_stage_name
  const stageName = job.display_stage_name || job.current_stage_name || '';
  
  if (!stageName) {
    console.log('⚠️ No stage name found for job:', job.wo_no);
    return null;
  }
  
  const normalizedStage = stageName.toLowerCase().trim();
  console.log('🔍 Checking stage for job:', job.wo_no, '→', stageName, '(normalized:', normalizedStage, ')');
  
  // Direct mapping lookup first
  if (STAGE_TO_MASTER_QUEUE_MAP[normalizedStage]) {
    const result = STAGE_TO_MASTER_QUEUE_MAP[normalizedStage];
    console.log('✅ Direct mapping found:', normalizedStage, '→', result);
    return result;
  }
  
  // Enhanced pattern matching for any variations we might have missed
  // HP 12000 patterns
  if (normalizedStage.includes('12000') || 
      (normalizedStage.includes('hp') && normalizedStage.includes('12000')) ||
      (normalizedStage.includes('printing') && normalizedStage.includes('12000'))) {
    console.log('✅ Pattern match HP 12000:', normalizedStage);
    return 'hp12000';
  }
  
  // HP 7900 patterns  
  if (normalizedStage.includes('7900') || 
      (normalizedStage.includes('hp') && normalizedStage.includes('7900')) ||
      (normalizedStage.includes('printing') && normalizedStage.includes('7900'))) {
    console.log('✅ Pattern match HP 7900:', normalizedStage);
    return 'hp7900';
  }
  
  // HP T250 patterns
  if (normalizedStage.includes('t250') || normalizedStage.includes('t 250') ||
      (normalizedStage.includes('hp') && normalizedStage.includes('t250')) ||
      (normalizedStage.includes('printing') && normalizedStage.includes('t250'))) {
    console.log('✅ Pattern match HP T250:', normalizedStage);
    return 'hpt250';
  }
  
  console.log('❌ No master queue match found for:', normalizedStage);
  return null;
};

/**
 * Enhanced job categorization with comprehensive master queue detection and detailed logging
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

  console.log('🔍 ENHANCED job categorization starting with:', jobs.length, 'jobs');
  
  // Enhanced debugging: Log all unique stage names for analysis
  const uniqueDisplayStages = new Set<string>();
  const uniqueCurrentStages = new Set<string>();
  const stageCounts: Record<string, number> = {};
  
  jobs.forEach(job => {
    if (job.display_stage_name) {
      uniqueDisplayStages.add(job.display_stage_name);
      stageCounts[job.display_stage_name] = (stageCounts[job.display_stage_name] || 0) + 1;
    }
    if (job.current_stage_name) {
      uniqueCurrentStages.add(job.current_stage_name);
      if (!job.display_stage_name) {
        stageCounts[job.current_stage_name] = (stageCounts[job.current_stage_name] || 0) + 1;
      }
    }
  });
  
  console.log('📊 STAGE ANALYSIS:');
  console.log('Display stages found:', Array.from(uniqueDisplayStages).sort());
  console.log('Current stages found:', Array.from(uniqueCurrentStages).sort());
  console.log('Stage job counts:', stageCounts);

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
      console.log('📍 Master queue DETECTED for job:', job.wo_no, '→', masterQueueCategory);
      
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
      console.log('⚠️ NO master queue detected for job:', job.wo_no, 'with stage:', job.display_stage_name || job.current_stage_name);
      
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
      } else {
        categorized.otherJobs.push(job);
        console.log('❓ Added to Other (uncategorized):', job.wo_no, 'stage:', effectiveStageName);
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

  console.log('📊 ENHANCED Master Queue Categorization Results:', results);
  console.log('🎯 Total jobs categorized:', Object.values(results).reduce((a, b) => a + b, 0));
  
  // CRITICAL: Expected printing job counts validation
  const expectedPrintingJobs = 90; // 31+14 HP12000 + 31+6 HP7900 + 8 T250
  const actualPrintingJobs = results.hp12000 + results.hp7900 + results.hpT250;
  
  console.log('🚨 PRINTING JOBS VALIDATION:');
  console.log('Expected printing jobs:', expectedPrintingJobs);
  console.log('Actual printing jobs:', actualPrintingJobs);
  console.log('Missing printing jobs:', expectedPrintingJobs - actualPrintingJobs);
  
  if (actualPrintingJobs < expectedPrintingJobs) {
    console.log('❌ MISSING PRINTING JOBS! Analyzing uncategorized jobs:');
    categorized.otherJobs.forEach(job => {
      const stageName = job.display_stage_name || job.current_stage_name || '';
      if (stageName.toLowerCase().includes('print') || 
          stageName.toLowerCase().includes('hp') ||
          stageName.toLowerCase().includes('12000') ||
          stageName.toLowerCase().includes('7900') ||
          stageName.toLowerCase().includes('t250')) {
        console.log('🔍 Potential missed printing job:', {
          wo_no: job.wo_no,
          display_stage_name: job.display_stage_name,
          current_stage_name: job.current_stage_name,
          normalized: stageName.toLowerCase()
        });
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
