/**
 * Type definitions for the production scheduler
 */

export interface ScheduledStage {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  stage_name: string;
  job_wo_no: string;
  stage_order: number;
  estimated_duration_minutes: number;
  scheduled_start_at: Date;
  scheduled_end_at: Date;
  proof_approved_at: Date;
  category_id: string;
}

export interface WorkingDayContainer {
  date: string;
  day_name: string;
  total_capacity_minutes: number;
  used_minutes: number;
  remaining_minutes: number;
  scheduled_stages: ScheduledStage[];
}

export interface WorkingDayCapacity {
  daily_capacity_minutes: number;
  shift_start_hour: number;
  shift_end_hour: number;
  lunch_break_start_hour: number;
  lunch_break_duration_minutes: number;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  duration_minutes: number;
}