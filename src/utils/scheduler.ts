/**
 * Centralized scheduler utility to prevent drift between different entry points
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SchedulerResult {
  wrote_slots: number;
  updated_jsi: number;
  violations: any[];
}

export interface SchedulerValidation {
  job_id: string;
  violation_type: string;
  stage1_name: string;
  stage1_order: number;
  stage2_name: string;
  stage2_order: number;
  violation_details: string;
}

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
export async function rescheduleAll(startFrom?: string): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 Starting reschedule via DB wrapper simple_scheduler_wrapper...');

    // Note: startFrom is not currently used by the wrapper; kept for API compatibility
    const { data, error } = await supabase.rpc('scheduler_reschedule_all_parallel_aware');

    if (error) {
      console.error('Reschedule error:', error);
      toast.error(`Reschedule failed: ${error.message}`);
      return null;
    }

    const arr: any[] = Array.isArray(data) ? (data as any[]) : [];
    const result: any = arr[0] || {};
    const wroteSlots = result?.wrote_slots ?? 0;
    const updatedJSI = result?.updated_jsi ?? 0;

    // Parallel-aware RPC returns violations array (may be empty)
    const violations = Array.isArray(result?.violations) ? result.violations : [];

    console.log('🔄 Reschedule completed via wrapper:', {
      wroteSlots,
      updatedJSI,
      violations: violations.length,
    });

    return {
      wrote_slots: wroteSlots,
      updated_jsi: updatedJSI,
      violations,
    };
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
      p_start_from: null,
      p_only_if_unset: !forceReschedule
    });
    
    if (error) {
      console.error('Error scheduling jobs:', error);
      toast.error(`Failed to schedule jobs: ${error.message}`);
      return null;
    }
    
    const result = (data as any)?.[0] || {};
    return {
      wrote_slots: result?.wrote_slots ?? 0,
      updated_jsi: result?.updated_jsi ?? 0,
      violations: []
    };
  } catch (error) {
    console.error('Error scheduling jobs:', error);
    toast.error(`Failed to schedule jobs: ${error}`);
    return null;
  }
}