
import { BatchStatus } from "@/config/types/baseTypes";

// Define LaminationType locally since it doesn't exist in baseTypes.ts
export type LaminationType = "none" | "gloss" | "matt" | "soft_touch";

// Re-export BatchStatus for convenience
export { BatchStatus };

export type FlyerSize = "A5" | "A4" | "DL" | "A3";
export type PaperType = "Matt" | "Gloss";

export interface FlyerBatch {
  id: string;
  name: string;
  status: BatchStatus;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null; // Ensure this property is included
  due_date: string;
  created_at: string;
  lamination_type: LaminationType;
  // Add missing properties needed by the UI
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
  // Update the status type to include "sent_to_print"
  status: "queued" | "batched" | "completed" | "cancelled" | "sent_to_print";
  pdf_url: string;
  file_name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}
