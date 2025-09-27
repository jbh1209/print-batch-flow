/**
 * SCHEDULER UTILITY - VERSION 20241227_1438
 * Date: December 27, 2024
 * Time: 14:38 UTC
 * Clean scheduler utility with versioning to prevent drift
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
 * Main reschedule function - VERSION 20241227_1438
 */
export async function rescheduleAll(startFrom?: string): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 SCHEDULER VERSION 20241227_1438: Starting reschedule via edge function...');
    
    const baseTime = startFrom || getFactoryBaseTime();
    console.log('🔄 SCHEDULER VERSION 20241227_1438: Base scheduling time:', baseTime);
    
    // VERSION 20241227_1438: Route to clean versioned scheduler
    const { data, error } = await supabase.functions.invoke('scheduler-run-20241227_1438', {
      body: {
        commit: true,
        onlyIfUnset: false,
        startFrom: baseTime
      }
    });

    if (error) {
      console.error('SCHEDULER VERSION 20241227_1438 reschedule error:', error);
      toast.error(`Reschedule failed: ${error.message}`);
      return null;
    }

    const result = data || {};
    const wroteSlots = result?.wroteSlots ?? result?.wrote_slots ?? 0;
    const updatedJSI = result?.updatedJSI ?? result?.updated_jsi ?? 0;
    const violations = Array.isArray(result?.violations) ? result.violations : [];

    console.log('🔄 SCHEDULER VERSION 20241227_1438: Reschedule completed:', { 
      wroteSlots, 
      updatedJSI, 
      violations: violations.length 
    });
    
    return {
      wrote_slots: wroteSlots,
      updated_jsi: updatedJSI,
      violations
    };
  } catch (error) {
    console.error('SCHEDULER VERSION 20241227_1438 reschedule failed:', error);
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
 * Schedule specific jobs - VERSION 20241227_1438
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