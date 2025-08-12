import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkflowFirstScheduling } from './useWorkflowFirstScheduling';
import { toast } from 'sonner';

interface UseAdvancedSchedulingProps {
  jobId?: string;
  jobTableName?: string;
  stageId?: string;
}

export const useAdvancedScheduling = ({
  jobId,
  jobTableName = 'production_jobs',
  stageId
}: UseAdvancedSchedulingProps = {}) => {
  const queryClient = useQueryClient();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const { scheduleJob, validateJobWorkflow, recalculateAllJobs } = useWorkflowFirstScheduling();

  // Get advanced schedule for a specific job using new workflow engine
  const {
    data: advancedSchedule,
    isLoading: isLoadingSchedule,
    error: scheduleError
  } = useQuery({
    queryKey: ['workflow-schedule', jobId, jobTableName],
    queryFn: async () => {
      if (!jobId) return null;
      
      // Use the new workflow validation
      const validation = await validateJobWorkflow(jobId);
      const scheduleResult = await scheduleJob(jobId, jobTableName);
      
      return {
        validation,
        schedule: scheduleResult,
        jobId,
        // Mock data for backward compatibility
        queuePositions: [],
        criticalPath: [],
        alternativeTimelines: {}
      };
    },
    enabled: !!jobId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Mock stage queue status for backward compatibility
  const stageQueueStatus = null;
  const isLoadingQueue = false;
  const queueError = null;

  // Optimize job flow using new workflow engine
  const optimizeJobFlow = async (departmentId?: string) => {
    setIsOptimizing(true);
    try {
      const result = await recalculateAllJobs();
      const optimizationsApplied = result?.successful || 0;
      const estimatedTimeSaved = optimizationsApplied * 2; // Rough estimate
      const bottlenecksResolved: string[] = [];
      
      toast.success(`Applied ${optimizationsApplied} optimizations, saved ~${estimatedTimeSaved}h`);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['workflow-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['stage-queue-status'] });
      
      return { optimizationsApplied, estimatedTimeSaved, bottlenecksResolved };
    } catch (error) {
      console.error('Job flow optimization error:', error);
      toast.error('Failed to optimize job flow');
      throw error;
    } finally {
      setIsOptimizing(false);
    }
  };

  // Mock calculate insertion for backward compatibility
  const calculateOptimalInsertion = async (params: any) => {
    console.log('Calculate optimal insertion not implemented in workflow-first engine');
    return null;
  };

  // Helper functions
  const getQueuePosition = (stageId: string) => {
    if (!advancedSchedule) return null;
    return advancedSchedule.queuePositions.find((pos: any) => pos.stageId === stageId);
  };

  const getBottleneckStages = () => {
    if (!advancedSchedule) return [];
    return advancedSchedule.queuePositions.filter((pos: any) => pos.isBottleneck);
  };

  const getCriticalPathStages = () => {
    if (!advancedSchedule) return [];
    return advancedSchedule.queuePositions.filter((pos: any) => 
      advancedSchedule.criticalPath.includes(pos.stageId)
    );
  };

  const formatTimeEstimate = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays} days`;
    if (diffDays <= 14) return `${Math.round(diffDays / 7)} week`;
    return `${Math.round(diffDays / 7)} weeks`;
  };

  const getScheduleConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAlternativeTimeline = (scenario: 'optimistic' | 'realistic' | 'pessimistic') => {
    if (!advancedSchedule?.alternativeTimelines) return null;
    return advancedSchedule.alternativeTimelines[scenario];
  };

  return {
    // Data
    advancedSchedule,
    stageQueueStatus,
    
    // Loading states
    isLoadingSchedule,
    isLoadingQueue,
    isOptimizing,
    isCalculatingInsertion: false,
    
    // Errors
    scheduleError,
    queueError,
    
    // Actions
    optimizeJobFlow,
    calculateOptimalInsertion,
    
    // Helper functions
    getQueuePosition,
    getBottleneckStages,
    getCriticalPathStages,
    formatTimeEstimate,
    getScheduleConfidenceColor,
    getAlternativeTimeline,
    
    // Mutation results
    insertionResult: null,
    optimizationResult: null,
  };
};