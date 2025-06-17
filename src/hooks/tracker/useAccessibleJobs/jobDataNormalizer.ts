
import { AccessibleJob } from './types';

export const normalizeJobData = (rawJob: any, index: number): AccessibleJob => {
  const normalized: AccessibleJob = {
    job_id: rawJob.job_id || rawJob.id || `temp-${index}`,
    wo_no: rawJob.wo_no || `WO-${index}`,
    customer: rawJob.customer || 'Unknown Customer',
    status: rawJob.status || 'Unknown',
    due_date: rawJob.due_date || '',
    reference: rawJob.reference || '',
    category_id: rawJob.category_id || '',
    category_name: rawJob.category_name || '',
    category_color: rawJob.category_color || '#6B7280',
    current_stage_id: rawJob.current_stage_id || '',
    current_stage_name: rawJob.current_stage_name || '',
    current_stage_color: rawJob.current_stage_color || '#6B7280',
    current_stage_status: rawJob.current_stage_status || 'pending',
    user_can_view: Boolean(rawJob.user_can_view),
    user_can_edit: Boolean(rawJob.user_can_edit),
    user_can_work: Boolean(rawJob.user_can_work),
    user_can_manage: Boolean(rawJob.user_can_manage),
    workflow_progress: rawJob.workflow_progress || 0,
    total_stages: rawJob.total_stages || 0,
    completed_stages: rawJob.completed_stages || 0,
    master_queue_id: rawJob.master_queue_id || undefined,
    display_stage_name: rawJob.display_stage_name || rawJob.current_stage_name || ''
  };

  console.log(`🔧 Normalized job ${normalized.wo_no}:`, {
    stage: normalized.current_stage_name,
    displayStage: normalized.display_stage_name,
    masterQueue: normalized.master_queue_id,
    hasConsolidation: normalized.display_stage_name !== normalized.current_stage_name
  });

  return normalized;
};
