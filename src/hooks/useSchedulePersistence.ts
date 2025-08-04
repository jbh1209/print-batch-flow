import { useState, useCallback } from 'react';
import type { DynamicDaySchedule } from '@/services/dynamicProductionScheduler';

interface ScheduleCache {
  schedule: DynamicDaySchedule[];
  timestamp: number;
  weekKey: string;
  stageId: string;
}

const CACHE_KEY = 'weekly_production_schedule';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const useSchedulePersistence = () => {
  const [cachedSchedules, setCachedSchedules] = useState<Map<string, ScheduleCache>>(new Map());

  const generateCacheKey = useCallback((weekStart: Date, stageId: string) => {
    return `${weekStart.toISOString().split('T')[0]}_${stageId}`;
  }, []);

  const getCache = useCallback((weekStart: Date, stageId: string): DynamicDaySchedule[] | null => {
    const key = generateCacheKey(weekStart, stageId);
    const cached = cachedSchedules.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    const isExpired = (now - cached.timestamp) > CACHE_DURATION;
    
    if (isExpired) {
      setCachedSchedules(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      return null;
    }
    
    return cached.schedule;
  }, [cachedSchedules, generateCacheKey]);

  const setCache = useCallback((
    weekStart: Date, 
    stageId: string, 
    schedule: DynamicDaySchedule[]
  ) => {
    const key = generateCacheKey(weekStart, stageId);
    const cacheEntry: ScheduleCache = {
      schedule,
      timestamp: Date.now(),
      weekKey: key,
      stageId
    };
    
    setCachedSchedules(prev => new Map(prev.set(key, cacheEntry)));
  }, [generateCacheKey]);

  const invalidateCache = useCallback((weekStart?: Date, stageId?: string) => {
    if (weekStart && stageId) {
      const key = generateCacheKey(weekStart, stageId);
      setCachedSchedules(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    } else {
      // Clear all cache
      setCachedSchedules(new Map());
    }
  }, [generateCacheKey]);

  const clearExpiredCache = useCallback(() => {
    const now = Date.now();
    setCachedSchedules(prev => {
      const newMap = new Map();
      prev.forEach((cache, key) => {
        if ((now - cache.timestamp) <= CACHE_DURATION) {
          newMap.set(key, cache);
        }
      });
      return newMap;
    });
  }, []);

  return {
    getCache,
    setCache,
    invalidateCache,
    clearExpiredCache
  };
};