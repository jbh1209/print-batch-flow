import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advancedSchedulingEngine } from '@/services/advancedSchedulingEngine';
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

  // Get advanced schedule for a specific job
  const {
    data: advancedSchedule,
    isLoading: isLoadingSchedule,
    error: scheduleError
  } = useQuery({
    queryKey: ['advanced-schedule', jobId, jobTableName],
    queryFn: () => 
      jobId 
        ? advancedSchedulingEngine.calculateAdvancedSchedule(jobId, jobTableName)
        : Promise.resolve(null),
    enabled: !!jobId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Get stage queue status
  const {
    data: stageQueueStatus,
    isLoading: isLoadingQueue,
    error: queueError
  } = useQuery({
    queryKey: ['stage-queue-status', stageId],
    queryFn: () => 
      stageId 
        ? advancedSchedulingEngine.getStageQueueStatus(stageId)
        : Promise.resolve(null),
    enabled: !!stageId,
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });

  // Optimize job flow mutation
  const optimizeJobFlowMutation = useMutation({
    mutationFn: (departmentId?: string) => 
      advancedSchedulingEngine.optimizeJobFlow(departmentId),
    onSuccess: (result) => {
      toast.success(
        `Applied ${result.optimizationsApplied} optimizations, saved ~${Math.round(result.estimatedTimeSaved)}h`
      );
      if (result.bottlenecksResolved.length > 0) {
        toast.info(`Resolved bottlenecks: ${result.bottlenecksResolved.join(', ')}`);
      }
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['advanced-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['stage-queue-status'] });
      queryClient.invalidateQueries({ queryKey: ['stage-workloads'] });
    },
    onError: (error) => {
      console.error('Error optimizing job flow:', error);
      toast.error('Failed to optimize job flow');
    }
  });

  // Calculate optimal insertion position
  const calculateInsertionMutation = useMutation({
    mutationFn: ({
      stageId,
      estimatedDuration,
      priority,
      dueDate
    }: {
      stageId: string;
      estimatedDuration: number;
      priority: number;
      dueDate?: Date;
    }) => advancedSchedulingEngine.calculateOptimalInsertion(
      stageId,
      estimatedDuration,
      priority,
      dueDate
    ),
    onError: (error) => {
      console.error('Error calculating insertion position:', error);
      toast.error('Failed to calculate optimal position');
    }
  });

  // Helper functions
  const getQueuePosition = (stageId: string) => {
    if (!advancedSchedule) return null;
    return advancedSchedule.queuePositions.find(pos => pos.stageId === stageId);
  };

  const getBottleneckStages = () => {
    if (!advancedSchedule) return [];
    return advancedSchedule.queuePositions.filter(pos => pos.isBottleneck);
  };

  const getCriticalPathStages = () => {
    if (!advancedSchedule) return [];
    return advancedSchedule.queuePositions.filter(pos => 
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
    isOptimizing: optimizeJobFlowMutation.isPending,
    isCalculatingInsertion: calculateInsertionMutation.isPending,
    
    // Errors
    scheduleError,
    queueError,
    
    // Actions
    optimizeJobFlow: optimizeJobFlowMutation.mutate,
    calculateOptimalInsertion: calculateInsertionMutation.mutate,
    
    // Helper functions
    getQueuePosition,
    getBottleneckStages,
    getCriticalPathStages,
    formatTimeEstimate,
    getScheduleConfidenceColor,
    getAlternativeTimeline,
    
    // Mutation results
    insertionResult: calculateInsertionMutation.data,
    optimizationResult: optimizeJobFlowMutation.data,
  };
};