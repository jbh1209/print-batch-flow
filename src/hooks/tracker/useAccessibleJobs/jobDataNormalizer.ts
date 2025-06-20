
import { AccessibleJob } from "./types";

export const normalizeJobData = (job: any, index: number): AccessibleJob => {
  const normalized: AccessibleJob = {
    job_id: job.job_id || '',
    wo_no: job.wo_no || `Job ${index + 1}`,
    customer: job.customer || 'Unknown Customer',
    status: job.status || 'Unknown',
    due_date: job.due_date || '',
    reference: job.reference || '',
    category_id: job.category_id || '',
    category_name: job.category_name || '',
    category_color: job.category_color || '#6B7280',
    current_stage_id: job.current_stage_id || '',
    current_stage_name: job.current_stage_name || 'No Stage',
    current_stage_color: job.current_stage_color || '#6B7280',
    current_stage_status: job.current_stage_status || 'pending',
    user_can_view: Boolean(job.user_can_view),
    user_can_edit: Boolean(job.user_can_edit),
    user_can_work: Boolean(job.user_can_work),
    user_can_manage: Boolean(job.user_can_manage),
    workflow_progress: Number(job.workflow_progress) || 0,
    total_stages: Number(job.total_stages) || 0,
    completed_stages: Number(job.completed_stages) || 0,
    display_stage_name: job.display_stage_name || job.current_stage_name || 'No Stage',
    qty: Number(job.qty) || 0 // Added qty normalization
  };

  console.log('🔄 Normalized job data:', {
    wo_no: normalized.wo_no,
    current_stage_name: normalized.current_stage_name,
    display_stage_name: normalized.display_stage_name,
    stage_status: normalized.current_stage_status,
    qty: normalized.qty
  });

  return normalized;
};
