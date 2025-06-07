import { formatWONumber } from "@/utils/woNumberFormatter";
import type { AccessibleJob } from "./types";

export const normalizeJobData = (job: any, index: number): AccessibleJob => {
  try {
    // Determine if this job has workflow system based on stage data
    const hasWorkflow = Boolean(job.current_stage_id && job.current_stage_id !== '00000000-0000-0000-0000-000000000000');
    
    // For legacy jobs without workflow, create virtual stage info based on status
    let currentStageId = job.current_stage_id;
    let currentStageName = job.current_stage_name;
    let currentStageStatus = job.current_stage_status || 'pending';
    
    if (!hasWorkflow && job.status) {
      // Map job status to virtual stage info for legacy jobs
      currentStageName = job.status;
      currentStageStatus = 'pending'; // Legacy jobs start as pending
      // Keep the stage ID if provided, or use null
    }

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
      current_stage_id: currentStageId ? String(currentStageId) : null,
      current_stage_name: currentStageName ? String(currentStageName) : null,
      current_stage_color: job.current_stage_color ? String(job.current_stage_color) : null,
      current_stage_status: currentStageStatus as 'active' | 'pending' | 'completed',
      user_can_view: Boolean(job.user_can_view),
      user_can_edit: Boolean(job.user_can_edit),
      user_can_work: Boolean(job.user_can_work),
      user_can_manage: Boolean(job.user_can_manage),
      workflow_progress: hasWorkflow ? (Number(job.workflow_progress) || 0) : 0,
      total_stages: hasWorkflow ? (Number(job.total_stages) || 0) : 1,
      completed_stages: hasWorkflow ? (Number(job.completed_stages) || 0) : 0,
      has_workflow: hasWorkflow
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
      completed_stages: 0,
      has_workflow: false
    } as AccessibleJob;
  }
};
