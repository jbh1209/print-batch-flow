import { useMemo } from 'react';
import { useUserStagePermissions } from './useUserStagePermissions';
import { useStageContextFiltering, StageContext } from './useStageContextFiltering';
import { useAuth } from '@/hooks/useAuth';

interface ContextAwareStagesResult {
  // Raw data for admin/debugging
  allStages: ReturnType<typeof useUserStagePermissions>['accessibleStages'];
  allConsolidatedStages: ReturnType<typeof useUserStagePermissions>['consolidatedStages'];
  
  // Filtered data for operators
  contextStages: ReturnType<typeof useStageContextFiltering>['filteredStages'];
  stageCount: number;
  userContext: StageContext;
  
  // State
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
}

/**
 * Main hook that provides context-aware stage data with proper filtering
 * This is the single source of truth for stage permissions in the application
 */
export const useContextAwareStages = (forceContext?: StageContext): ContextAwareStagesResult => {
  const { user } = useAuth();
  
  // Get raw stage permissions from database
  const { 
    accessibleStages, 
    consolidatedStages, 
    isLoading, 
    error, 
    isAdmin 
  } = useUserStagePermissions(user?.id);

  // Apply context-aware filtering to prevent permission leaks
  const { 
    filteredStages, 
    stageCount, 
    context 
  } = useStageContextFiltering(consolidatedStages, isAdmin, forceContext);

  return useMemo(() => ({
    // Raw data (admin/debugging use only)
    allStages: accessibleStages,
    allConsolidatedStages: consolidatedStages,
    
    // Filtered data (primary use for operators)
    contextStages: filteredStages,
    stageCount,
    userContext: context,
    
    // State
    isLoading,
    error,
    isAdmin
  }), [
    accessibleStages,
    consolidatedStages,
    filteredStages,
    stageCount,
    context,
    isLoading,
    error,
    isAdmin
  ]);
};

/**
 * Specialized hook for printing operators - only shows printing master queues
 */
export const usePrintingOperatorStages = () => {
  return useContextAwareStages('printing');
};

/**
 * Specialized hook for DTP operators - only shows DTP and proofing stages  
 */
export const useDtpOperatorStages = () => {
  return useContextAwareStages('dtp');
};

/**
 * Specialized hook for batch operators - only shows batch allocation stages
 */
export const useBatchOperatorStages = () => {
  return useContextAwareStages('batch_allocation');
};

/**
 * Get stage display name with proper master queue handling
 */
export const useStageDisplayName = (stageId: string, context?: StageContext) => {
  const { contextStages } = useContextAwareStages(context);
  
  return useMemo(() => {
    const stage = contextStages.find(s => s.stage_id === stageId);
    return stage?.stage_name || 'Unknown Stage';
  }, [contextStages, stageId]);
};