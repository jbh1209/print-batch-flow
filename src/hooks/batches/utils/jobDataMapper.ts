
import { Job, JobStatus } from "@/components/batches/types/BatchTypes";

export const mapJobsToConsistentInterface = (jobs: any[]): Job[] => {
  return jobs.map(job => ({
    id: job.id,
    name: job.name,
    file_name: job.file_name || job.name || "",
    lamination_type: "none", // Default since specifications are now stored separately
    quantity: job.quantity || 0,
    due_date: job.due_date || new Date().toISOString(),
    uploaded_at: job.created_at || new Date().toISOString(),
    status: job.status as JobStatus,
    pdf_url: job.pdf_url || null,
    job_number: job.job_number || job.name || "",
    updated_at: job.updated_at || new Date().toISOString(),
    user_id: job.user_id || "",
    double_sided: job.double_sided !== undefined ? job.double_sided : (job.single_sided !== undefined ? !job.single_sided : false)
  })) as Job[];
};
