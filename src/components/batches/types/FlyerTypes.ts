
import { BatchStatus, LaminationType, JobStatus } from "@/config/types/baseTypes";

// Import directly from baseTypes instead of productTypes
export type { BatchStatus, LaminationType, JobStatus };

export type FlyerSize = "A5" | "A4" | "DL" | "A3";
export type PaperType = "Matt" | "Gloss";

export interface FlyerBatch {
  id: string;
  name: string;
  status: BatchStatus;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null; // Property needed by the UI
  due_date: string;
  created_at: string;
  lamination_type: LaminationType | string;
  // Add missing properties needed by FlyerBatchDetails.tsx
  paper_type?: string;
  paper_weight?: string;
  sheet_size?: string;
  printer_type?: string;
  created_by: string;
  updated_at: string;
  date_created?: string;
}

export interface FlyerJob {
  id: string;
  name: string;
  job_number: string;
  size: FlyerSize;
  paper_weight: string;
  paper_type: PaperType;
  quantity: number;
  due_date: string;
  batch_id: string | null;
  // Update the status type to include all JobStatus values from baseTypes
  status: JobStatus;
  pdf_url: string;
  file_name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  uploaded_at: string; // Add the uploaded_at field to match Job interface
}
