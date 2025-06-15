
export interface JobStageWithDetails {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  stage_order: number;
  job_order_in_stage: number; // NEW: explicit per-stage job order (NOT NULL, always present from DB)
  status: 'pending' | 'active' | 'completed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  notes?: string;
  production_stage: {
    id: string;
    name: string;
    color: string;
    description?: string;
  };
  production_job?: {
    id: string;
    wo_no: string;
    customer?: string;
    category?: string;
    due_date?: string;
  };
}
