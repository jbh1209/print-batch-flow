/**
 * SCHEDULER UTILITY - VERSION 20241227_1445
 * Date: December 27, 2024
 * Time: 14:45 UTC
 * PARALLEL PART ASSIGNMENT LOGIC FOR COVER/TEXT PROCESSING
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
 * Main reschedule function - VERSION 20241227_1445 - PARALLEL PARTS
 */
export async function rescheduleAll(startFrom?: string): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 SCHEDULER VERSION 20241227_1445: Starting parallel parts reschedule via edge function...');
    
    const baseTime = startFrom || getFactoryBaseTime();
    console.log('🔄 SCHEDULER VERSION 20241227_1445: Base scheduling time:', baseTime);
    
    // VERSION 20241227_1445: Route to parallel parts scheduler with fallback
    let data, error;
    
    try {
      const result = await supabase.functions.invoke('scheduler-run-20241227_1445', {
        body: {
          commit: true,
          onlyIfUnset: false,
          startFrom: baseTime
        }
      });
      data = result.data;
      error = result.error;
    } catch (versionedError) {
      console.warn('Versioned scheduler failed, falling back to stable scheduler-run:', versionedError);
      const result = await supabase.functions.invoke('scheduler-run', {
        body: {
          commit: true,
          onlyIfUnset: false,
          startFrom: baseTime
        }
      });
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('SCHEDULER VERSION 20241227_1445 reschedule error:', error);
      toast.error(`Reschedule failed: ${error.message}`);
      return null;
    }

    const result = data || {};
    
    // Handle structured error responses from edge function
    if (result.ok === false) {
      console.error('SCHEDULER VERSION 20241227_1445 structured error:', result);
      
      if (result.errorCode === 'LUNCH_BREAK_OVERLAP') {
        toast.error(`⚠️ Scheduling conflict: ${result.error || 'Time slots overlap lunch break (12:00-12:30)'}`);
      } else {
        toast.error(`Scheduling error: ${result.error || 'Unknown scheduling issue'}`);
      }
      return null;
    }

    const wroteSlots = result?.wrote_slots ?? 0;
    const updatedJSI = result?.scheduled_count ?? 0;
    const violations = Array.isArray(result?.violations) ? result.violations : [];

    console.log('🔄 SCHEDULER VERSION 20241227_1445: Parallel parts reschedule completed:', { 
      wroteSlots, 
      updatedJSI, 
      violations: violations.length,
      version: result?.version
    });
    
    return {
      wrote_slots: wroteSlots,
      updated_jsi: updatedJSI,
      violations
    };
  } catch (error) {
    console.error('SCHEDULER VERSION 20241227_1445 reschedule failed:', error);
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
 * Schedule specific jobs - VERSION 20241227_1445 - PARALLEL PARTS
 */
export async function scheduleJobs(jobIds: string[], forceReschedule = false): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 SCHEDULER VERSION 20241227_1445: Scheduling specific jobs with parallel parts logic...');
    
    // Try versioned scheduler with fallback to stable
    let data, error;
    
    try {
      const result = await supabase.functions.invoke('scheduler-run-20241227_1445', {
        body: {
          commit: true,
          onlyIfUnset: !forceReschedule,
          onlyJobIds: jobIds
        }
      });
      data = result.data;
      error = result.error;
    } catch (versionedError) {
      console.warn('Versioned scheduler failed, falling back to stable scheduler-run:', versionedError);
      const result = await supabase.functions.invoke('scheduler-run', {
        body: {
          commit: true,
          onlyIfUnset: !forceReschedule,
          onlyJobIds: jobIds
        }
      });
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.error('Error scheduling jobs:', error);
      toast.error(`Failed to schedule jobs: ${error.message}`);
      return null;
    }
    
    const result = data || {};
    console.log('🔄 SCHEDULER VERSION 20241227_1445: Job scheduling completed:', {
      scheduled_count: result?.scheduled_count,
      wrote_slots: result?.wrote_slots,
      version: result?.version
    });
    
    return {
      wrote_slots: result?.wrote_slots ?? 0,
      updated_jsi: result?.scheduled_count ?? 0,
      violations: []
    };
  } catch (error) {
    console.error('Error scheduling jobs:', error);
    toast.error(`Failed to schedule jobs: ${error}`);
    return null;
  }
}