/**
 * Hook for enhanced workflow management API operations
 * Provides optimized batch operations and caching
 */

import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StageUpdate {
  stageId: string;
  quantity?: number;
  estimatedDurationMinutes?: number;
  partAssignment?: 'cover' | 'text' | 'both' | null;
  stageSpecificationId?: string | null;
  stageOrder?: number;
}

interface WorkflowMetrics {
  totalStages: number;
  completeStages: number;
  partialStages: number;
  emptyStages: number;
  totalQuantity: number;
  totalDurationMinutes: number;
  estimatedCompletionDays: number;
  validationStatus: string;
  configurationWarnings: string[];
}

interface ValidationResult {
  status: string;
  lastModified: string;
  totalStages: number;
  issues: string[];
  warnings: string[];
  isValid: boolean;
}

export function useWorkflowAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [cache, setCache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());

  // Cache management
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedData = useCallback((key: string) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, [cache]);

  const setCachedData = useCallback((key: string, data: any) => {
    setCache(prev => new Map(prev.set(key, { data, timestamp: Date.now() })));
  }, []);

  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      setCache(prev => {
        const newCache = new Map(prev);
        for (const key of newCache.keys()) {
          if (key.includes(pattern)) {
            newCache.delete(key);
          }
        }
        return newCache;
      });
    } else {
      setCache(new Map());
    }
  }, []);

  // Batch update stages with optimistic updates
  const batchUpdateStages = useCallback(async (
    jobId: string, 
    updates: StageUpdate[],
    options: { optimistic?: boolean } = {}
  ) => {
    setIsLoading(true);
    
    try {
      // Optimistic update - update local cache immediately
      if (options.optimistic) {
        const cacheKey = `metrics-${jobId}`;
        const cachedMetrics = getCachedData(cacheKey);
        if (cachedMetrics) {
          // Update cached metrics optimistically
          setCachedData(cacheKey, {
            ...cachedMetrics,
            // Recalculate based on updates
            totalQuantity: updates.reduce((sum, update) => sum + (update.quantity || 0), cachedMetrics.totalQuantity),
            totalDurationMinutes: updates.reduce((sum, update) => sum + (update.estimatedDurationMinutes || 0), cachedMetrics.totalDurationMinutes)
          });
        }
      }

      const { data, error } = await supabase.functions.invoke('workflow-management/batch-update', {
        body: { jobId, updates }
      });

      if (error) {
        throw error;
      }

      // Invalidate related cache entries
      invalidateCache(jobId);

      const result = data;
      
      if (result.errors && result.errors.length > 0) {
        console.warn('Some updates failed:', result.errors);
        toast.warning(`Updated ${result.updatedCount} stages, ${result.errors.length} failed`);
      } else {
        toast.success(`Successfully updated ${result.updatedCount} stages`);
      }

      return result;
    } catch (error) {
      console.error('Batch update error:', error);
      toast.error('Failed to update stages');
      
      // Revert optimistic updates by invalidating cache
      invalidateCache(jobId);
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getCachedData, setCachedData, invalidateCache]);

  // Get workflow metrics with caching
  const getWorkflowMetrics = useCallback(async (jobId: string, useCache = true): Promise<WorkflowMetrics> => {
    const cacheKey = `metrics-${jobId}`;
    
    if (useCache) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        return cached;
      }
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('workflow-management/metrics', {
        body: { jobId }
      });

      if (error) {
        throw error;
      }

      const metrics = data.metrics;
      setCachedData(cacheKey, metrics);
      
      return metrics;
    } catch (error) {
      console.error('Metrics error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getCachedData, setCachedData]);

  // Validate workflow configuration
  const validateWorkflow = useCallback(async (jobId: string): Promise<ValidationResult> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('workflow-management/validate', {
        body: { jobId }
      });

      if (error) {
        throw error;
      }

      return data.validation;
    } catch (error) {
      console.error('Validation error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calculate durations for stages
  const calculateDurations = useCallback(async (
    jobId: string, 
    stageIds?: string[]
  ) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('workflow-management/calculate-durations', {
        body: { jobId, stageIds }
      });

      if (error) {
        throw error;
      }

      // Invalidate metrics cache after duration calculation
      invalidateCache(`metrics-${jobId}`);

      const result = data;
      toast.success(`Calculated durations for ${result.updatedCount} stages`);
      
      return result;
    } catch (error) {
      console.error('Duration calculation error:', error);
      toast.error('Failed to calculate durations');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [invalidateCache]);

  // Bulk operations helper
  const performBulkOperation = useCallback(async (
    jobId: string,
    operation: 'update-quantity' | 'update-duration' | 'update-part',
    value: any,
    stageIds?: string[]
  ) => {
    setIsLoading(true);
    
    try {
      // Get current stages
      let query = supabase
        .from('job_stage_instances')
        .select('production_stage_id, quantity, estimated_duration_minutes, part_assignment')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      if (stageIds && stageIds.length > 0) {
        query = query.in('production_stage_id', stageIds);
      }

      const { data: stages, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Prepare bulk updates
      const updates: StageUpdate[] = stages?.map(stage => {
        const update: StageUpdate = { stageId: stage.production_stage_id };
        
        switch (operation) {
          case 'update-quantity':
            update.quantity = typeof value === 'number' ? value : parseInt(value);
            break;
          case 'update-duration':
            update.estimatedDurationMinutes = typeof value === 'number' ? value : parseInt(value);
            break;
          case 'update-part':
            update.partAssignment = value;
            break;
        }
        
        return update;
      }) || [];

      // Perform batch update with optimistic updates
      return await batchUpdateStages(jobId, updates, { optimistic: true });
    } catch (error) {
      console.error('Bulk operation error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [batchUpdateStages]);

  // Memoized cache stats for debugging
  const cacheStats = useMemo(() => ({
    size: cache.size,
    keys: Array.from(cache.keys()),
    oldestEntry: Math.min(...Array.from(cache.values()).map(v => v.timestamp)),
  }), [cache]);

  return {
    // Loading state
    isLoading,
    
    // Core operations
    batchUpdateStages,
    getWorkflowMetrics,
    validateWorkflow,
    calculateDurations,
    performBulkOperation,
    
    // Cache management
    invalidateCache,
    cacheStats,
    
    // Convenience methods
    updateAllQuantities: (jobId: string, quantity: number, stageIds?: string[]) => 
      performBulkOperation(jobId, 'update-quantity', quantity, stageIds),
    updateAllDurations: (jobId: string, duration: number, stageIds?: string[]) => 
      performBulkOperation(jobId, 'update-duration', duration, stageIds),
    updateAllPartAssignments: (jobId: string, partAssignment: 'cover' | 'text' | 'both' | null, stageIds?: string[]) => 
      performBulkOperation(jobId, 'update-part', partAssignment, stageIds),
  };
}