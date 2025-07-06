
// --- UPDATED: Enriched production job includes category details (from useProductionJobs) ---
export interface JobStageWithDetails {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  stage_order: number;
  job_order_in_stage: number;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'blocked';
  started_at?: string;
  completed_at?: string;
  notes?: string;
  part_name?: string;
  // Master queue consolidation properties
  display_stage_id?: string;
  is_subsidiary_stage?: boolean;
  master_queue_stage_id?: string | null;
  // Concurrent workflow properties
  stage_dependency_group?: string;
  allows_concurrent_start?: boolean;
  part_flow_chain?: string[];
  requires_all_parts_complete?: boolean;
  concurrent_stage_group_id?: string;
  production_stage: {
    id: string;
    name: string;
    color: string;
    description?: string;
    master_queue_id?: string | null;
    allows_concurrent_start?: boolean;
    requires_all_parts_complete?: boolean;
    master_queue?: {
      id: string;
      name: string;
    } | null;
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
