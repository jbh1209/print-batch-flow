/**
 * Hook for workflow performance optimizations
 * Implements background processing, debouncing, and batching
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

interface BatchedOperation {
  id: string;
  type: 'update' | 'validate' | 'calculate';
  payload: any;
  timestamp: number;
  retryCount: number;
}

interface OptimizationConfig {
  batchSize: number;
  batchDelay: number;
  maxRetries: number;
  debounceMs: number;
}

const DEFAULT_CONFIG: OptimizationConfig = {
  batchSize: 10,
  batchDelay: 1000, // 1 second
  maxRetries: 3,
  debounceMs: 500,
};

export function useWorkflowOptimizations(config: Partial<OptimizationConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Operation queues
  const operationQueue = useRef<BatchedOperation[]>([]);
  const processingTimer = useRef<NodeJS.Timeout | null>(null);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Background processing
  const processQueue = useCallback(async () => {
    if (operationQueue.current.length === 0) {
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    const batch = operationQueue.current.splice(0, finalConfig.batchSize);
    setQueueSize(operationQueue.current.length);

    console.log(`Processing batch of ${batch.length} operations`);

    try {
      // Group operations by type for efficient processing
      const groupedOps = batch.reduce((groups, op) => {
        if (!groups[op.type]) groups[op.type] = [];
        groups[op.type].push(op);
        return groups;
      }, {} as Record<string, BatchedOperation[]>);

      // Process each group
      for (const [type, ops] of Object.entries(groupedOps)) {
        try {
          await processOperationGroup(type, ops);
          setProcessedCount(prev => prev + ops.length);
        } catch (error) {
          console.error(`Failed to process ${type} operations:`, error);
          
          // Retry failed operations
          const retriableOps = ops.filter(op => op.retryCount < finalConfig.maxRetries);
          retriableOps.forEach(op => {
            op.retryCount++;
            operationQueue.current.push(op);
          });
          
          const failedOps = ops.filter(op => op.retryCount >= finalConfig.maxRetries);
          setFailedCount(prev => prev + failedOps.length);
          
          if (failedOps.length > 0) {
            toast.error(`${failedOps.length} operations failed after max retries`);
          }
        }
      }
    } catch (error) {
      console.error('Batch processing error:', error);
    }

    // Schedule next batch processing
    if (operationQueue.current.length > 0) {
      processingTimer.current = setTimeout(processQueue, finalConfig.batchDelay);
    } else {
      setIsProcessing(false);
    }
  }, [finalConfig]);

  const processOperationGroup = async (type: string, operations: BatchedOperation[]) => {
    switch (type) {
      case 'update':
        await processBatchUpdates(operations);
        break;
      case 'validate':
        await processBatchValidations(operations);
        break;
      case 'calculate':
        await processBatchCalculations(operations);
        break;
      default:
        console.warn(`Unknown operation type: ${type}`);
    }
  };

  const processBatchUpdates = async (operations: BatchedOperation[]) => {
    // Group by job ID for efficient batch processing
    const jobGroups = operations.reduce((groups, op) => {
      const jobId = op.payload.jobId;
      if (!groups[jobId]) groups[jobId] = [];
      groups[jobId].push(op.payload);
      return groups;
    }, {} as Record<string, any[]>);

    // Process each job's updates
    for (const [jobId, updates] of Object.entries(jobGroups)) {
      try {
        // This would call the actual API - simplified for now
        console.log(`Batch updating ${updates.length} operations for job ${jobId}`);
        // await batchUpdateStages(jobId, updates);
      } catch (error) {
        console.error(`Failed to update job ${jobId}:`, error);
        throw error;
      }
    }
  };

  const processBatchValidations = async (operations: BatchedOperation[]) => {
    const uniqueJobIds = [...new Set(operations.map(op => op.payload.jobId))];
    
    for (const jobId of uniqueJobIds) {
      try {
        console.log(`Validating workflow for job ${jobId}`);
        // await validateWorkflow(jobId);
      } catch (error) {
        console.error(`Failed to validate job ${jobId}:`, error);
        throw error;
      }
    }
  };

  const processBatchCalculations = async (operations: BatchedOperation[]) => {
    // Group by job ID and merge stage IDs
    const jobCalculations = operations.reduce((groups, op) => {
      const { jobId, stageIds } = op.payload;
      if (!groups[jobId]) groups[jobId] = new Set();
      if (stageIds) {
        stageIds.forEach((id: string) => groups[jobId].add(id));
      }
      return groups;
    }, {} as Record<string, Set<string>>);

    for (const [jobId, stageIdsSet] of Object.entries(jobCalculations)) {
      try {
        const stageIds = Array.from(stageIdsSet);
        console.log(`Calculating durations for ${stageIds.length} stages in job ${jobId}`);
        // await calculateDurations(jobId, stageIds);
      } catch (error) {
        console.error(`Failed to calculate durations for job ${jobId}:`, error);
        throw error;
      }
    }
  };

  // Queue management
  const queueOperation = useCallback((
    type: 'update' | 'validate' | 'calculate',
    payload: any,
    immediate = false
  ) => {
    const operation: BatchedOperation = {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    if (immediate) {
      // Process immediately, bypassing queue
      processOperationGroup(type, [operation]).catch(error => {
        console.error('Immediate operation failed:', error);
        setFailedCount(prev => prev + 1);
      });
    } else {
      // Add to queue
      operationQueue.current.push(operation);
      setQueueSize(operationQueue.current.length);

      // Start processing if not already running
      if (!isProcessing && !processingTimer.current) {
        processingTimer.current = setTimeout(processQueue, finalConfig.batchDelay);
      }
    }
  }, [finalConfig, isProcessing, processQueue]);

  // Debounced operations
  const debouncedOperation = useCallback((
    key: string,
    type: 'update' | 'validate' | 'calculate',
    payload: any
  ) => {
    // Clear existing timer for this key
    const existingTimer = debounceTimers.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      queueOperation(type, payload);
      debounceTimers.current.delete(key);
    }, finalConfig.debounceMs);

    debounceTimers.current.set(key, timer);
  }, [queueOperation, finalConfig]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingTimer.current) {
        clearTimeout(processingTimer.current);
      }
      
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
    };
  }, []);

  // Priority queue for urgent operations
  const queuePriorityOperation = useCallback((
    type: 'update' | 'validate' | 'calculate',
    payload: any
  ) => {
    const operation: BatchedOperation = {
      id: `priority-${type}-${Date.now()}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Insert at the beginning of the queue
    operationQueue.current.unshift(operation);
    setQueueSize(operationQueue.current.length);

    // Process immediately if not already processing
    if (!isProcessing) {
      processQueue();
    }
  }, [isProcessing, processQueue]);

  // Queue statistics
  const getQueueStats = useCallback(() => {
    const now = Date.now();
    const operations = operationQueue.current;
    
    return {
      total: operations.length,
      byType: operations.reduce((counts, op) => {
        counts[op.type] = (counts[op.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>),
      oldestOperation: operations.length > 0 ? now - Math.min(...operations.map(op => op.timestamp)) : 0,
      averageAge: operations.length > 0 ? 
        (now - operations.reduce((sum, op) => sum + op.timestamp, 0) / operations.length) : 0,
    };
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    operationQueue.current = [];
    setQueueSize(0);
    
    if (processingTimer.current) {
      clearTimeout(processingTimer.current);
      processingTimer.current = null;
    }
    
    debounceTimers.current.forEach(timer => clearTimeout(timer));
    debounceTimers.current.clear();
    
    setIsProcessing(false);
  }, []);

  return {
    // State
    isProcessing,
    queueSize,
    processedCount,
    failedCount,
    
    // Queue operations
    queueOperation,
    queuePriorityOperation,
    debouncedOperation,
    
    // Queue management
    clearQueue,
    getQueueStats,
    
    // Convenience methods for common operations
    queueStageUpdate: (jobId: string, updates: any[]) => 
      queueOperation('update', { jobId, updates }),
    queueWorkflowValidation: (jobId: string) => 
      queueOperation('validate', { jobId }),
    queueDurationCalculation: (jobId: string, stageIds?: string[]) => 
      queueOperation('calculate', { jobId, stageIds }),
      
    // Debounced versions
    debouncedStageUpdate: (jobId: string, updates: any[]) => 
      debouncedOperation(`update-${jobId}`, 'update', { jobId, updates }),
    debouncedValidation: (jobId: string) => 
      debouncedOperation(`validate-${jobId}`, 'validate', { jobId }),
  };
}