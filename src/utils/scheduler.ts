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


export async function rescheduleAll(): Promise<SchedulerResult | null> {
  try {
    console.log('📅 Triggering scheduler-run (append mode)...');
    
    const { data, error } = await supabase.functions.invoke('simple-scheduler', {
      body: {
        commit: true,
        proposed: false,
        onlyIfUnset: true,
        nuclear: false,
      }
    });

    if (error) {
      console.error('❌ Scheduler error:', error);
      throw error;
    }

    if (!data?.ok) {
      throw new Error(data?.error || 'Unknown scheduler error');
    }

    console.log('✅ Scheduler result:', data);

    return {
      wrote_slots: data.scheduled || 0,
      updated_jsi: data.jobs_considered || 0,
      violations: [],
    };
  } catch (err: any) {
    console.error('💥 rescheduleAll failed:', err);
    throw err;
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