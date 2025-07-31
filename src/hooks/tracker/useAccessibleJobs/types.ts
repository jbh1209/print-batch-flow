

export interface ParallelStageInfo {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_status: string;
  stage_order: number;
  part_assignment?: string;
}

export interface AccessibleJob {
  job_id: string;
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  reference: string;
  category_id?: string;
  category_name: string;
  category_color: string; 
  current_stage_id?: string;
  current_stage_name: string;
  current_stage_color: string;
  current_stage_status: string;
  user_can_view: boolean;
  user_can_edit: boolean;
  user_can_work: boolean;
  user_can_manage: boolean;
  workflow_progress: number;
  total_stages: number;
  completed_stages: number;
  display_stage_name: string;
  qty: number;
  has_custom_workflow: boolean;
  manual_due_date?: string | null;
  batch_category?: string | null;
  is_in_batch_processing: boolean;
  // Additional fields for enhanced compatibility
  started_by?: string | null;
  started_by_name?: string | null;
  proof_emailed_at?: string | null;
  // Batch master job properties
  is_batch_master?: boolean;
  batch_name?: string | null;
  constituent_job_count?: number;
  // Parallel stages support
  parallel_stages?: ParallelStageInfo[];
  current_stage_order?: number;
  // Virtual stage entry support for parallel workflows
  is_virtual_stage_entry?: boolean;
  stage_instance_id?: string;
  parent_job_id?: string;
  part_assignment?: string;
}

export interface UseAccessibleJobsOptions {
  permissionType?: 'view' | 'edit' | 'work' | 'manage';
  statusFilter?: string | null;
  stageFilter?: string | null;
}

