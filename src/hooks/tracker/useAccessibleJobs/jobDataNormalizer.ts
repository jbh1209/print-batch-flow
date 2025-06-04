
import { formatWONumber } from "@/utils/woNumberFormatter";
import type { AccessibleJob } from "./types";

export const normalizeJobData = (job: any, index: number): AccessibleJob => {
  try {
    // Ensure all required fields are present and properly typed
    const normalizedJob: AccessibleJob = {
      job_id: String(job.job_id || ''),
      wo_no: formatWONumber(job.wo_no) || '',
      customer: String(job.customer || 'Unknown'),
      status: String(job.status || 'Unknown'),
      due_date: String(job.due_date || ''),
      reference: job.reference ? String(job.reference) : null,
      category_id: job.category_id ? String(job.category_id) : null,
      category_name: job.category_name ? String(job.category_name) : null,
      category_color: job.category_color ? String(job.category_color) : null,
      current_stage_id: job.current_stage_id ? String(job.current_stage_id) : null,
      current_stage_name: job.current_stage_name ? String(job.current_stage_name) : null,
      current_stage_color: job.current_stage_color ? String(job.current_stage_color) : null,
      // Use actual database stage status - default to 'pending' for clean state
      current_stage_status: job.current_stage_status || 'pending',
      user_can_view: Boolean(job.user_can_view),
      user_can_edit: Boolean(job.user_can_edit),
      user_can_work: Boolean(job.user_can_work),
      user_can_manage: Boolean(job.user_can_manage),
      workflow_progress: Number(job.workflow_progress) || 0,
      total_stages: Number(job.total_stages) || 0,
      completed_stages: Number(job.completed_stages) || 0
    };

    // Validate numeric fields are within expected ranges
    if (normalizedJob.workflow_progress < 0 || normalizedJob.workflow_progress > 100) {
      console.warn(`⚠️ Invalid workflow_progress for job ${normalizedJob.job_id}:`, normalizedJob.workflow_progress);
      normalizedJob.workflow_progress = 0;
    }

    if (normalizedJob.total_stages < 0) {
      console.warn(`⚠️ Invalid total_stages for job ${normalizedJob.job_id}:`, normalizedJob.total_stages);
      normalizedJob.total_stages = 0;
    }

    if (normalizedJob.completed_stages < 0) {
      console.warn(`⚠️ Invalid completed_stages for job ${normalizedJob.job_id}:`, normalizedJob.completed_stages);
      normalizedJob.completed_stages = 0;
    }

    return normalizedJob;
  } catch (jobError) {
    console.error(`❌ Error normalizing job at index ${index}:`, jobError, job);
    // Return a minimal valid job object to prevent crashes
    return {
      job_id: String(job.job_id || index),
      wo_no: 'ERROR',
      customer: 'Error Loading Job',
      status: 'Unknown',
      due_date: '',
      reference: null,
      category_id: null,
      category_name: null,
      category_color: null,
      current_stage_id: null,
      current_stage_name: null,
      current_stage_color: null,
      current_stage_status: 'pending',
      user_can_view: false,
      user_can_edit: false,
      user_can_work: false,
      user_can_manage: false,
      workflow_progress: 0,
      total_stages: 0,
      completed_stages: 0
    } as AccessibleJob;
  }
};
