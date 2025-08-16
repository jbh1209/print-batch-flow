import { supabase } from "@/integrations/supabase/client";

/**
 * CAPACITY SERVICE: Stage capacity normalization
 * Reads from stage_capacity_profiles table and provides simple dailyMinutes number
 */

export interface StageCapacity {
  dailyMinutes: number;
  startHour: number;
  endHour: number;
  maxParallelJobs: number;
  setupTimeMinutes: number;
}

/**
 * Normalize stage capacity profile into a simple capacity object
 * Maps database capacity profiles to scheduler-friendly format
 */
export async function normalizeCapacityForStage(stageId: string): Promise<StageCapacity> {
  const { data, error } = await supabase
    .from('stage_capacity_profiles')
    .select(`
      daily_capacity_hours,
      max_parallel_jobs,
      setup_time_minutes,
      shift_hours_per_day
    `)
    .eq('production_stage_id', stageId)
    .maybeSingle();

  if (error) {
    console.warn(`No capacity profile found for stage ${stageId}, using defaults:`, error);
    return {
      dailyMinutes: 8.5 * 60, // 8.5 hours = 510 minutes
      startHour: 8,
      endHour: 17.5, // 17:30
      maxParallelJobs: 1,
      setupTimeMinutes: 10
    };
  }

  return {
    dailyMinutes: (data?.daily_capacity_hours || 8.5) * 60,
    startHour: 8, // Always 8 AM SAST business start
    endHour: 17.5, // Always 5:30 PM SAST business end
    maxParallelJobs: data?.max_parallel_jobs || 1,
    setupTimeMinutes: data?.setup_time_minutes || 10
  };
}

/**
 * Get capacity for multiple stages at once
 */
export async function normalizeCapacitiesForStages(stageIds: string[]): Promise<Map<string, StageCapacity>> {
  const { data, error } = await supabase
    .from('stage_capacity_profiles')
    .select(`
      production_stage_id,
      daily_capacity_hours,
      max_parallel_jobs,
      setup_time_minutes,
      shift_hours_per_day
    `)
    .in('production_stage_id', stageIds);

  if (error) {
    console.warn('Error fetching capacity profiles:', error);
  }

  const capacityMap = new Map<string, StageCapacity>();

  // Add profiles from database
  (data || []).forEach((profile: any) => {
    capacityMap.set(profile.production_stage_id, {
      dailyMinutes: (profile.daily_capacity_hours || 8.5) * 60,
      startHour: 8,
      endHour: 17.5,
      maxParallelJobs: profile.max_parallel_jobs || 1,
      setupTimeMinutes: profile.setup_time_minutes || 10
    });
  });

  // Add defaults for missing stages
  stageIds.forEach(stageId => {
    if (!capacityMap.has(stageId)) {
      capacityMap.set(stageId, {
        dailyMinutes: 8.5 * 60,
        startHour: 8,
        endHour: 17.5,
        maxParallelJobs: 1,
        setupTimeMinutes: 10
      });
    }
  });

  return capacityMap;
}