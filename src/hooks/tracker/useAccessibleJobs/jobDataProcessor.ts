
import { AccessibleJob } from "./types";

export interface RawJobData {
  id: string;
  job_id?: string;
  wo_no?: string;
  customer?: string;
  status?: string;
  due_date?: string;
  reference?: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  current_stage_id?: string;
  current_stage_name?: string;
  current_stage_color?: string;
  current_stage_status?: string;
  user_can_view?: boolean;
  user_can_edit?: boolean;
  user_can_work?: boolean;
  user_can_manage?: boolean;
  workflow_progress?: number;
  total_stages?: number;
  completed_stages?: number;
  display_stage_name?: string;
  qty?: number;
  has_custom_workflow?: boolean;
  manual_due_date?: string | null;
  started_by?: string | null;
  started_by_name?: string | null;
  proof_emailed_at?: string | null;
  contact?: string | null;
  // Additional fields from enhanced production jobs
  current_stage?: string;
  stages?: any[];
  job_stage_instances?: any[];
}

export const processJobData = (rawJob: RawJobData, index: number = 0): AccessibleJob => {
  console.log(`🔧 Processing job data for ${rawJob.wo_no || rawJob.id}:`, {
    hasCustomWorkflow: rawJob.has_custom_workflow,
    manualDueDate: rawJob.manual_due_date,
    regularDueDate: rawJob.due_date,
    woNo: rawJob.wo_no
  });

  // CRITICAL: Handle due date logic for custom workflows
  let effectiveDueDate = rawJob.due_date || '';
  
  // For custom workflows, prefer manual_due_date over due_date
  if (rawJob.has_custom_workflow && rawJob.manual_due_date) {
    effectiveDueDate = rawJob.manual_due_date;
    console.log(`✅ Using manual due date for custom workflow ${rawJob.wo_no}: ${effectiveDueDate}`);
  } else if (rawJob.has_custom_workflow && !rawJob.manual_due_date) {
    console.log(`⚠️ Custom workflow ${rawJob.wo_no} missing manual due date`);
  }

  const processed: AccessibleJob = {
    job_id: rawJob.job_id || rawJob.id || '',
    id: rawJob.job_id || rawJob.id || '', // Ensure id is present
    wo_no: rawJob.wo_no || `Job ${index + 1}`,
    customer: rawJob.customer || 'Unknown Customer',
    status: rawJob.status || 'Unknown',
    due_date: effectiveDueDate, // This is the key fix - always use effective due date
    reference: rawJob.reference || '',
    category_id: rawJob.category_id || undefined,
    category_name: rawJob.category_name || '',
    category_color: rawJob.category_color || '#6B7280',
    current_stage_id: rawJob.current_stage_id || undefined,
    current_stage_name: rawJob.current_stage_name || rawJob.current_stage || 'No Stage',
    current_stage_color: rawJob.current_stage_color || '#6B7280',
    current_stage_status: rawJob.current_stage_status || 'pending',
    user_can_view: Boolean(rawJob.user_can_view),
    user_can_edit: Boolean(rawJob.user_can_edit),
    user_can_work: Boolean(rawJob.user_can_work),
    user_can_manage: Boolean(rawJob.user_can_manage),
    workflow_progress: Number(rawJob.workflow_progress) || 0,
    total_stages: Number(rawJob.total_stages) || 0,
    completed_stages: Number(rawJob.completed_stages) || 0,
    display_stage_name: rawJob.display_stage_name || rawJob.current_stage_name || rawJob.current_stage || 'No Stage',
    qty: Number(rawJob.qty) || 0,
    has_custom_workflow: Boolean(rawJob.has_custom_workflow),
    manual_due_date: rawJob.manual_due_date || null,
    started_by: rawJob.started_by || null,
    started_by_name: rawJob.started_by_name || null,
    proof_emailed_at: rawJob.proof_emailed_at || null,
    contact: rawJob.contact || null,
    batch_category: null, // Will be set by batch processing logic
    is_in_batch_processing: rawJob.status === 'In Batch Processing'
  };

  console.log(`✅ Processed job ${processed.wo_no}:`, {
    effectiveDueDate: processed.due_date,
    hasCustomWorkflow: processed.has_custom_workflow,
    manualDueDate: processed.manual_due_date
  });

  return processed;
};

export const processJobsArray = (rawJobs: RawJobData[]): AccessibleJob[] => {
  console.log(`🔄 Processing ${rawJobs.length} jobs with centralized processor`);
  
  return rawJobs.map((job, index) => processJobData(job, index));
};
