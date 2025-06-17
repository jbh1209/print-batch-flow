
export interface AccessibleJob {
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  reference: string;
  category_id: string;
  category_name: string;
  category_color: string;
  current_stage_id: string;
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
  master_queue_id?: string;
  display_stage_name?: string;
}

export interface UseAccessibleJobsOptions {
  permissionType?: 'view' | 'edit' | 'work' | 'manage';
  statusFilter?: string | null;
  stageFilter?: string | null;
}
