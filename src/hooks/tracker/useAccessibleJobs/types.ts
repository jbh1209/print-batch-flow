
export interface AccessibleJob {
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  reference: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_color: string | null;
  current_stage_status: 'active' | 'pending' | 'completed' | 'hold';
  user_can_view: boolean;
  user_can_edit: boolean;
  user_can_work: boolean;
  user_can_manage: boolean;
  workflow_progress: number;
  total_stages: number;
  completed_stages: number;
  has_workflow?: boolean; // Add this to track job type
}

export interface UseAccessibleJobsOptions {
  permissionType?: 'view' | 'edit' | 'work' | 'manage';
  statusFilter?: string | null;
  stageFilter?: string | null;
}
