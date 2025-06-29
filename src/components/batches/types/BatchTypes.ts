import { LaminationType } from "./FlyerTypes";

// Make JobStatus flexible to handle database string values
export type JobStatus = "queued" | "batched" | "completed" | "cancelled" | string;

// Make BatchStatus flexible to handle database string values  
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled" | string;

export interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  lamination_type: LaminationType;
  due_date: string;
  uploaded_at: string;
  status: JobStatus; // Now accepts any string
  pdf_url: string;
  double_sided?: boolean;
  job_number?: string;
  updated_at?: string;
  user_id?: string;
  paper_type?: string;
}

export interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: BatchStatus; // Now accepts any string
  product_type: string;
  sheets_required?: number;
  lamination_type?: LaminationType | null;
  front_pdf_url?: string | null;
  back_pdf_url?: string | null;
  created_at: string;
}

export interface BatchDetailsType {
  id: string;
  name: string;
  lamination_type: LaminationType | null;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: string;
}
