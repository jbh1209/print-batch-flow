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
 * Main reschedule function - routes through edge function to avoid DB timeouts
 * @param division - Optional division filter (e.g., 'DIG', 'OFF')
 */
/**
 * Main reschedule function - uses APPEND MODE for tailing and gap-filling
 * @param division - Optional division filter (e.g., 'DIG', 'OFF')
 */
export async function rescheduleAll(division?: string): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 Starting reschedule (append mode) via Edge Function simple-scheduler...', { division });

    const { data, error } = await supabase.functions.invoke('simple-scheduler', {
      body: {
      commit: true,
      proposed: false,
      onlyIfUnset: true,   // APPEND MODE: enables tailing and gap-filling
      nuclear: false,       // Don't wipe everything
      wipeAll: false,       // Don't wipe everything
      division
      }
    });

    if (error) {
      console.error('Reschedule error:', error);
      toast.error(`Reschedule failed: ${error.message}`);
      return null;
    }

    const result: any = (data as any) || {};
    const wroteSlots = result?.scheduled ?? result?.applied?.wrote_slots ?? 0;
    const updatedJSI = result?.applied?.updated ?? result?.jobs_considered ?? 0;

    const violations = Array.isArray(result?.violations) ? result.violations : [];

    console.log('🔄 Reschedule completed via Edge Function:', {
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
 * Full reflow reschedule - ADMIN ONLY - wipes all future schedules and rebuilds from scratch
 * @param division - Optional division filter (e.g., 'DIG', 'OFF')
 */
export async function rescheduleAllFullReflow(division?: string): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 Starting FULL REFLOW reschedule (nuclear mode) via Edge Function simple-scheduler...', { division });

    const { data, error } = await supabase.functions.invoke('simple-scheduler', {
      body: {
      commit: true,
      proposed: false,
      onlyIfUnset: false,  // REFLOW MODE: ignore existing schedules
      nuclear: true,        // Full wipe and rebuild
      wipeAll: true,
      division
      }
    });

    if (error) {
      console.error('Full reflow reschedule error:', error);
      toast.error(`Full reflow reschedule failed: ${error.message}`);
      return null;
    }

    const result: any = (data as any) || {};
    const wroteSlots = result?.scheduled ?? result?.applied?.wrote_slots ?? 0;
    const updatedJSI = result?.applied?.updated ?? result?.jobs_considered ?? 0;

    const violations = Array.isArray(result?.violations) ? result.violations : [];

    console.log('🔄 Full reflow reschedule completed via Edge Function:', {
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
    console.error('Full reflow reschedule failed:', error);
    toast.error(`Full reflow reschedule failed: ${error}`);
    return null;
  }
}

/**
 * Schedule specific jobs
 * @param jobIds - Array of job IDs to schedule
 * @param forceReschedule - If true, force a reschedule even if already scheduled
 * @param division - Optional division filter (e.g., 'DIG', 'OFF')
 */
export async function scheduleJobs(jobIds: string[], forceReschedule = false, division?: string): Promise<SchedulerResult | null> {
  try {
    // Call restored scheduler_append_jobs (JSONB return)
    const { data, error } = await supabase.rpc('scheduler_append_jobs', {
      p_job_ids: jobIds,
      p_only_if_unset: !forceReschedule,
      p_division: division ?? null
    } as any);
    
    if (error) {
      console.error('Failed to schedule jobs:', error);
      toast.error('Failed to schedule jobs');
      return null;
    }
    
    // Parse JSONB result (flexible for both shapes)
    const row: any = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
    return {
      wrote_slots: Number(row?.wrote_slots ?? row?.slots_written ?? 0),
      updated_jsi: Number(row?.updated_jsi ?? row?.jobs_touched ?? 0),
      violations: []
    };
  } catch (error) {
    console.error('Error scheduling jobs:', error);
    toast.error('An error occurred while scheduling jobs');
    return null;
  }
}