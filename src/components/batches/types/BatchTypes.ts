
import { BatchStatus as ConfigBatchStatus, JobStatus as ConfigJobStatus } from "@/config/productTypes";

// Use type alias instead of enum to match config/productTypes.ts
export type BatchStatus = ConfigBatchStatus;
export type JobStatus = ConfigJobStatus;

// Add the missing BatchSummary interface
export interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: BatchStatus | string;
  product_type: string;
  sheets_required: number;
  lamination_type: string;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  created_at: string;
}

// Make sure Job type explicitly includes all required properties
export interface Job {
  id: string;
  name: string;
  quantity: number;
  status: JobStatus | string;
  pdf_url: string | null;
  file_name: string;
  lamination_type: string;
  due_date: string;
  uploaded_at: string;
  job_number: string;
  updated_at: string;
  user_id: string;
  double_sided?: boolean;
}

export interface BatchDetailsType {
  id: string;
  name: string;
  lamination_type: string;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: BatchStatus | string;
}
