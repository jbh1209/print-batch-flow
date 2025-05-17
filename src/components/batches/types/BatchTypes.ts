
import { BaseBatch, BatchStatus } from "@/config/types/baseTypes";
import { LaminationType, JobStatus } from "@/components/business-cards/JobsTable";

export interface BatchSummary extends BaseBatch {
  product_type: string;
  overview_pdf_url: string | null;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  created_at: string;
}

export interface BatchDetailsType extends BaseBatch {
  // Additional properties specific to batch details
}

export interface Job {
  id: string;
  name: string;
  quantity: number;
  status: string;
  pdf_url: string | null;
  job_number: string;  // Explicitly required, not optional
  size?: string;
  sides?: string;
  stock_type?: string;
  double_sided?: boolean;
  paper_type?: string;
  paper_weight?: string;
  lamination_type?: string;
  file_name?: string;
  created_at?: string;
  updated_at?: string;
  batch_id?: string | null;
  due_date: string;
  uploaded_at?: string;
  user_id?: string;
}
