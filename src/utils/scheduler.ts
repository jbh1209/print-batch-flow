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
 * Main reschedule function - uses parallel-aware scheduler
 */
export async function rescheduleAll(): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 Starting parallel-aware reschedule...');
    
    const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
      p_mode: 'reschedule_all'
    });

    if (error) {
      console.error('Reschedule error:', error);
      toast.error(`Reschedule failed: ${error.message}`);
      return null;
    }

    const result = (data as any)?.[0] || {};
    const wroteSlots = result?.wrote_slots ?? 0;
    const updatedJSI = result?.updated_jsi ?? 0;
    
    // Normalize violations - could be string, array, or object from jsonb
    let violations = [];
    if (result?.violations) {
      const violationsData = result.violations;
      if (Array.isArray(violationsData)) {
        violations = violationsData;
      } else if (typeof violationsData === 'string') {
        try {
          violations = JSON.parse(violationsData);
        } catch {
          violations = [];
        }
      } else if (typeof violationsData === 'object' && violationsData !== null) {
        violations = [violationsData];
      }
    }

    console.log('🔄 Reschedule completed:', { wroteSlots, updatedJSI, violations: violations.length });
    
    return {
      wrote_slots: wroteSlots,
      updated_jsi: updatedJSI,
      violations
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