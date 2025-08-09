import { useState, useEffect } from 'react';
import { getJobParallelStages, type ParallelStageInfo } from '@/utils/parallelStageUtils';
import { debugService } from '@/services/DebugService';

interface UseEnhancedParallelStagesProps {
  jobId: string;
  jobStages: any[];
}

export const useEnhancedParallelStages = ({ jobId, jobStages }: UseEnhancedParallelStagesProps) => {
  const [parallelStages, setParallelStages] = useState<ParallelStageInfo[]>([]);
  const [availableStages, setAvailableStages] = useState<ParallelStageInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!jobId || !jobStages?.length) {
      setParallelStages([]);
      setAvailableStages([]);
      return;
    }

    try {
      setIsProcessing(true);
      
      // Get current parallel stages for this job
      const stages = getJobParallelStages(jobStages, jobId);
      setParallelStages(stages);
      
      // Also determine available stages for progression
      const jobSpecificStages = jobStages.filter(stage => stage.job_id === jobId);
      const completedStages = jobSpecificStages.filter(stage => stage.status === 'completed');
      const pendingStages = jobSpecificStages.filter(stage => stage.status === 'pending');
      
      // Find stages that should be available based on completed stages
      const nextAvailableStages = pendingStages.filter(pendingStage => {
        // Check if any completed stage enables this pending stage
        return completedStages.some(completedStage => {
          // Same part assignment or compatible parts
          const completedPart = completedStage.part_assignment || 'both';
          const pendingPart = pendingStage.part_assignment || 'both';
          
          // Allow progression if:
          // 1. Same part assignment
          // 2. Completed stage was 'both' (enables specific parts)
          // 3. Next stage in sequence
          const samePartAssignment = completedPart === pendingPart;
          const completedBothEnablesPart = completedPart === 'both' && pendingPart !== 'both';
          const isNextInSequence = pendingStage.stage_order === completedStage.stage_order + 1;
          
          return (samePartAssignment || completedBothEnablesPart) && isNextInSequence;
        });
      });
      
      setAvailableStages(nextAvailableStages.map(stage => ({
        id: stage.id,
        stage_id: stage.production_stage_id,
        stage_name: stage.stage_name,
        stage_color: stage.stage_color || '#6B7280',
        stage_status: stage.status,
        stage_order: stage.stage_order,
        part_assignment: stage.part_assignment || null
      })));
      
      debugService.log('EnhancedParallelStages', 'stages_calculated', {
        jobId,
        currentStages: stages.length,
        availableStages: nextAvailableStages.length,
        completedCount: completedStages.length,
        pendingCount: pendingStages.length
      });

    } catch (error) {
      console.error('Error in useEnhancedParallelStages:', error);
      debugService.log('EnhancedParallelStages', 'error', { jobId, error: error?.toString() });
    } finally {
      setIsProcessing(false);
    }
  }, [jobId, jobStages]);

  const canStageStart = (stageId: string): boolean => {
    return availableStages.some(stage => stage.stage_id === stageId);
  };

  const getStagesByPartAssignment = (partAssignment?: string): ParallelStageInfo[] => {
    if (!partAssignment || partAssignment === 'both') {
      return parallelStages;
    }
    
    return parallelStages.filter(stage => 
      stage.part_assignment === partAssignment || 
      stage.part_assignment === 'both'
    );
  };

  return {
    parallelStages,
    availableStages,
    isProcessing,
    canStageStart,
    getStagesByPartAssignment
  };
};