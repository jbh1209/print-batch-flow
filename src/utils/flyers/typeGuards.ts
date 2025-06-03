import { BaseJob } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

export const isFlyerJob = (job: BaseJob): job is FlyerJob => {
  return (
    typeof job.name === "string" &&
    typeof job.job_number === "string" &&
    typeof job.size === "string" &&
    typeof job.paper_weight === "string" &&
    typeof job.paper_type === "string" &&
    typeof job.quantity === "number" &&
    typeof job.due_date === "string" &&
    (job.status === "queued" ||
      job.status === "batched" ||
      job.status === "completed" ||
      job.status === "cancelled") &&
    typeof job.pdf_url === "string" &&
    typeof job.file_name === "string" &&
    typeof job.user_id === "string" &&
    typeof job.created_at === "string" &&
    typeof job.updated_at === "string"
  );
};

export const transformBaseJobToFlyerJob = (job: BaseJob): FlyerJob => {
  if (!isFlyerJob(job)) {
    throw new Error("Job is not a FlyerJob");
  }

  const flyerJob: FlyerJob = {
    id: job.id,
    name: job.name,
    job_number: job.job_number,
    size: job.size,
    paper_weight: job.paper_weight,
    paper_type: job.paper_type,
    quantity: job.quantity,
    due_date: job.due_date,
    batch_id: job.batch_id,
    status: job.status,
    pdf_url: job.pdf_url,
    file_name: job.file_name,
    user_id: job.user_id,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };

  return flyerJob;
};

export const transformToFlyerJob = (job: any): FlyerJob => {
  return {
    id: job.id,
    name: job.name,
    job_number: job.job_number,
    size: job.size,
    paper_weight: job.paper_weight,
    quantity: job.quantity,
    paper_type: job.paper_type,
    due_date: job.due_date,
    created_at: job.created_at,
    status: job.status,
    pdf_url: job.pdf_url || '',
    file_name: job.file_name,
    user_id: job.user_id,
    updated_at: job.updated_at,
    batch_id: job.batch_id
  };
};

export const transformToGenericJob = (flyerJob: FlyerJob): BaseJob => {
  return {
      id: flyerJob.id,
      name: flyerJob.name,
      job_number: flyerJob.job_number,
      size: flyerJob.size,
      paper_weight: flyerJob.paper_weight,
      quantity: flyerJob.quantity,
      paper_type: flyerJob.paper_type,
      due_date: flyerJob.due_date,
      created_at: flyerJob.created_at,
      status: flyerJob.status,
      pdf_url: flyerJob.pdf_url || '',
      file_name: flyerJob.file_name,
      reference: flyerJob.reference,
      batch_id: flyerJob.batch_id
  };
};
