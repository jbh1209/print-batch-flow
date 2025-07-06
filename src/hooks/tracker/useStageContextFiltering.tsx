import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ConsolidatedStage, UserStagePermission } from '@/utils/tracker/stageConsolidation';

export type StageContext = 'printing' | 'dtp' | 'batch_allocation' | 'finishing' | 'admin';

interface StageContextFilter {
  filteredStages: ConsolidatedStage[];
  stageCount: number;
  context: StageContext;
}

/**
 * Filters stages based on user role and context to prevent permission leaks
 * and ensure users only see relevant stages for their work
 */
export const useStageContextFiltering = (
  consolidatedStages: ConsolidatedStage[],
  isAdmin: boolean,
  userContext?: StageContext
): StageContextFilter => {
  const { user } = useAuth();

  const filtered = useMemo(() => {
    if (!consolidatedStages || consolidatedStages.length === 0) {
      return {
        filteredStages: [],
        stageCount: 0,
        context: (userContext || 'admin') as StageContext
      };
    }

    // Detect route-based context override
    const routeBasedContext = detectRouteContext();
    const finalContext = routeBasedContext || userContext || detectUserContext(consolidatedStages);
    
    // Apply context-specific filtering (even for admins when they're in specific operator views)
    const contextFiltered = filterStagesByContext(consolidatedStages, finalContext, isAdmin);

    return {
      filteredStages: contextFiltered,
      stageCount: contextFiltered.length,
      context: finalContext
    };
  }, [consolidatedStages, isAdmin, userContext, user?.id]);

  return filtered;
};

/**
 * Detect context based on current route/page
 */
const detectRouteContext = (): StageContext | null => {
  if (typeof window === 'undefined') return null;
  
  const pathname = window.location.pathname;
  
  if (pathname.includes('/tracker/factory-floor') || pathname.includes('/tracker/dtp-workflow')) {
    return 'printing';
  }
  
  if (pathname.includes('/tracker/dtp')) {
    return 'dtp';
  }
  
  return null;
};

/**
 * Detect user context based on the stages they have access to
 */
const detectUserContext = (stages: ConsolidatedStage[]): StageContext => {
  const stageNames = stages.map(s => s.stage_name.toLowerCase());
  
  // Check for printing operator context
  const hasPrintingStages = stageNames.some(name => 
    name.includes('printing') || 
    name.includes('hp') || 
    name.includes('12000') || 
    name.includes('7900') || 
    name.includes('t250')
  );

  // Check for DTP operator context
  const hasDtpStages = stageNames.some(name =>
    name.includes('dtp') ||
    name.includes('design') ||
    name.includes('prepress') ||
    name.includes('artwork')
  );

  // Check for batch allocation context
  const hasBatchStages = stageNames.some(name =>
    name.includes('batch') ||
    name.includes('allocation')
  );

  // Check for finishing context
  const hasFinishingStages = stageNames.some(name =>
    name.includes('finish') ||
    name.includes('cutting') ||
    name.includes('lamination') ||
    name.includes('binding')
  );

  // Priority order: printing > dtp > batch > finishing
  if (hasPrintingStages) return 'printing';
  if (hasDtpStages) return 'dtp';
  if (hasBatchStages) return 'batch_allocation';
  if (hasFinishingStages) return 'finishing';
  
  return 'admin'; // fallback
};

/**
 * Filter stages based on user context to show only relevant stages
 */
const filterStagesByContext = (
  stages: ConsolidatedStage[], 
  context: StageContext,
  isAdmin: boolean
): ConsolidatedStage[] => {
  // Only show all stages to admin when they're in explicit admin context
  if (isAdmin && context === 'admin') {
    return stages;
  }

  return stages.filter(stage => {
    const stageName = stage.stage_name.toLowerCase();
    
    switch (context) {
      case 'printing':
        // Printing operators only see printing master queues and printing stages
        return stageName.includes('hp') ||
               stageName.includes('12000') ||
               stageName.includes('7900') ||
               stageName.includes('t250') ||
               stageName.includes('large format') ||
               (stage.is_master_queue && stage.subsidiary_stages.some(sub => 
                 sub.stage_name.toLowerCase().includes('hp') ||
                 sub.stage_name.toLowerCase().includes('12000') ||
                 sub.stage_name.toLowerCase().includes('7900') ||
                 sub.stage_name.toLowerCase().includes('t250') ||
                 sub.stage_name.toLowerCase().includes('printing')
               ));
      
      case 'dtp':
        // DTP operators see DTP and proofing stages
        return stageName.includes('dtp') ||
               stageName.includes('design') ||
               stageName.includes('prepress') ||
               stageName.includes('artwork') ||
               stageName.includes('proof') ||
               stageName.includes('approval');
      
      case 'batch_allocation':
        // Batch operators see batch-related stages
        return stageName.includes('batch') ||
               stageName.includes('allocation');
      
      case 'finishing':
        // Finishing operators see finishing stages
        return stageName.includes('finish') ||
               stageName.includes('cutting') ||
               stageName.includes('lamination') ||
               stageName.includes('binding') ||
               stageName.includes('folding');
      
      default:
        return true;
    }
  });
};

/**
 * Get stage names that should be hidden from specific contexts
 */
export const getHiddenStageNames = (context: StageContext): string[] => {
  const allContexts = ['printing', 'dtp', 'batch_allocation', 'finishing'];
  const otherContexts = allContexts.filter(c => c !== context);
  
  const hiddenPatterns: Record<string, string[]> = {
    printing: ['batch', 'allocation', 'finish', 'cutting', 'lamination'],
    dtp: ['hp', '12000', '7900', 't250', 'printing', 'finish', 'cutting'],
    batch_allocation: ['printing', 'hp', 'dtp', 'design', 'prepress'],
    finishing: ['printing', 'hp', 'dtp', 'design', 'batch', 'allocation']
  };
  
  return hiddenPatterns[context] || [];
};