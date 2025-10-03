
// --- UPDATED: Enriched production job includes category details (from useProductionJobs) ---
export interface JobStageWithDetails {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  stage_order: number;
  job_order_in_stage: number;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'on_hold';
  started_at?: string;
  completed_at?: string;
  notes?: string;
  completion_percentage?: number;
  remaining_minutes?: number;
  hold_reason?: string;
  held_at?: string;
  held_by?: string;
  scheduled_minutes?: number;
  production_stage: {
    id: string;
    name: string;
    color: string;
    description?: string;
  };
  // Now matches enriched ProductionJob+categories
  production_job?: {
    id: string;
    wo_no: string;
    customer?: string | null;
    category?: string | null;
    due_date?: string | null;
    category_name?: string | null;
    created_at?: string | null;
    categories?: {
      id: string;
      name: string;
      description?: string;
      color?: string;
      sla_target_days?: number | null;
    } | null;
    sla_target_days?: number | null; // May be injected for convenience
  };
}
