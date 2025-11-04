/**
 * Canonical TypeScript interfaces for the scheduling system
 * Single source of truth for all scheduler-related types
 */

export interface SchedulerJob {
  id: string;
  wo_no: string;
  proof_approved_at: string | null;
  category_id: string | null;
  due_date: string | null;
}

export interface SchedulerStageInstance {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_order: number;
  estimated_duration_minutes: number | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  status: string;
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

export interface GapFillRecord {
  id: string;
  stage_instance_id: string;
  scheduler_run_type: string;
  days_saved: number;
  created_at: string;
  original_window_id: string | null;
  new_window_id: string | null;
}

export interface SchedulerResult {
  success: boolean;
  updated_jsi: number;
  wrote_slots: number;
  violations: SchedulerValidation[];
  gap_fills?: GapFillRecord[];
  division?: string | null;
}

/**
 * Type guard to validate SchedulerResult structure
 */
export function isSchedulerResult(data: any): data is SchedulerResult {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.success === 'boolean' &&
    typeof data.updated_jsi === 'number' &&
    typeof data.wrote_slots === 'number' &&
    Array.isArray(data.violations)
  );
}

/**
 * Type guard to validate GapFillRecord structure
 */
export function isGapFillRecord(data: any): data is GapFillRecord {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    typeof data.stage_instance_id === 'string' &&
    typeof data.scheduler_run_type === 'string' &&
    typeof data.days_saved === 'number' &&
    typeof data.created_at === 'string'
  );
}
