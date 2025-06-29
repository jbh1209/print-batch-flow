
import { BatchStatus, LaminationType } from "@/config/productTypes";

// Import directly from the config file instead of from ./BatchTypes
export type { BatchStatus, LaminationType };

// Updated to be more flexible - these can now be any string
export type FlyerSize = string; // Changed from enum to string
export type PaperType = string; // Changed from enum to string

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
  lamination_type: LaminationType;
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
  size: string; // Changed from FlyerSize enum to string
  paper_weight: string;
  paper_type: string; // Changed from PaperType enum to string
  quantity: number;
  due_date: string;
  batch_id: string | null;
  // Add "cancelled" to the status type to match what's coming from the database
  status: "queued" | "batched" | "completed" | "cancelled";
  pdf_url: string;
  file_name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}
