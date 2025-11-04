/**
 * Centralized scheduler utility to prevent drift between different entry points
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SchedulerResult, SchedulerValidation, isSchedulerResult } from "@/types/scheduler";

/**
 * Get factory timezone base time for scheduling
 */
function getFactoryBaseTime(): string {
  const now = new Date();
  // Factory timezone (Africa/Johannesburg) - get start of next working day
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0); // 8 AM factory time
  
  return tomorrow.toISOString();
}

/**
 * Main reschedule function - routes through edge function to avoid DB timeouts
 */
export async function rescheduleAll(): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 Starting reschedule via Edge Function simple-scheduler...');

    const { data, error } = await supabase.functions.invoke('simple-scheduler', {
      body: {
        commit: true,
        proposed: false,
        onlyIfUnset: false,
        nuclear: true,
        wipeAll: true
      }
    });

    if (error) {
      console.error('Reschedule error:', error);
      toast.error(`Reschedule failed: ${error.message}`);
      return null;
    }

    // Type guard validation
    if (!isSchedulerResult(data)) {
      console.error('❌ Invalid scheduler response structure:', data);
      toast.error('Invalid scheduler response format');
      return null;
    }

    console.log('✅ Reschedule completed via Edge Function:', {
      wrote_slots: data.wrote_slots,
      updated_jsi: data.updated_jsi,
      violations: data.violations.length,
    });

    return data;
  } catch (error) {
    console.error('Reschedule failed:', error);
    toast.error(`Reschedule failed: ${error}`);
    return null;
  }
}

/**
 * Get validation results after scheduling
 */
export async function getSchedulingValidation(): Promise<SchedulerValidation[]> {
  try {
    const { data, error } = await supabase.rpc('validate_job_scheduling_precedence');
    
    if (error) {
      console.error('Validation check failed:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Validation check failed:', error);
    return [];
  }
}

/**
 * Schedule specific jobs
 */
export async function scheduleJobs(jobIds: string[], forceReschedule = false): Promise<SchedulerResult | null> {
  try {
    const { data, error } = await supabase.rpc('scheduler_append_jobs', {
      p_job_ids: jobIds,
      p_only_if_unset: !forceReschedule
    });
    
    if (error) {
      console.error('Error scheduling jobs:', error);
      toast.error(`Failed to schedule jobs: ${error.message}`);
      return null;
    }
    
    // Type guard validation
    if (!isSchedulerResult(data)) {
      console.error('❌ Invalid scheduler response structure:', data);
      toast.error('Invalid scheduler response format');
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error scheduling jobs:', error);
    toast.error(`Failed to schedule jobs: ${error}`);
    return null;
  }
}