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
 * Main reschedule function - uses parallel-aware scheduler engine
 */
export async function rescheduleAll(startFrom?: string): Promise<SchedulerResult | null> {
  try {
    console.log('🔄 Starting parallel-aware reschedule via simple-scheduler...');
    
    const baseTime = startFrom || getFactoryBaseTime();
    console.log('🔄 Base scheduling time:', baseTime);
    
    // Use parallel-aware scheduler engine directly
    const { data, error } = await supabase.functions.invoke('simple-scheduler', {
      body: {
        commit: true,
        proposed: false,
        onlyIfUnset: false,
        baseStart: baseTime
      }
    });

    if (error) {
      console.error('Parallel reschedule error:', error);
      toast.error(`Reschedule failed: ${error.message}`);
      return null;
    }

    const result = data || {};
    // Map simple-scheduler response format
    const updatedJSI = result?.scheduled ?? result?.applied?.updated ?? 0;
    const wroteSlots = result?.wrote_slots ?? 0; // simple-scheduler doesn't return this, default to 0
    
    // Violations are handled by post-reschedule validation check
    const violations: any[] = [];

    console.log('🔄 Parallel reschedule completed:', { 
      scheduled: updatedJSI, 
      wroteSlots,
      engine: 'parallel-aware'
    });
    
    return {
      wrote_slots: wroteSlots,
      updated_jsi: updatedJSI,
      violations
    };
  } catch (error) {
    console.error('Parallel reschedule failed:', error);
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

/**
 * Verification helper - log stage timeline for a specific job
 */
export async function logJobStageTimeline(jobId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        stage_order,
        part_assignment,
        scheduled_start_at,
        scheduled_end_at,
        production_stage:production_stages(name)
      `)
      .eq('job_id', jobId)
      .order('stage_order');
    
    if (error) {
      console.error('Failed to fetch job timeline:', error);
      return;
    }
    
    console.log(`📋 Job ${jobId} stage timeline:`);
    data?.forEach(stage => {
      const stageName = (stage.production_stage as any)?.name || 'Unknown';
      const startTime = stage.scheduled_start_at ? new Date(stage.scheduled_start_at).toLocaleString() : 'Not scheduled';
      const endTime = stage.scheduled_end_at ? new Date(stage.scheduled_end_at).toLocaleString() : 'Not scheduled';
      
      console.log(`  ${stage.stage_order}. ${stageName} (${stage.part_assignment}): ${startTime} → ${endTime}`);
    });
  } catch (error) {
    console.error('Error logging job timeline:', error);
  }
}