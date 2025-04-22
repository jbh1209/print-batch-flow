
// Define the status type to match what's in the database
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled";
export type LaminationType = "none" | "matt" | "gloss" | "soft_touch";

export interface BatchDetailsType {
  id: string;
  name: string;
  lamination_type: LaminationType;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: BatchStatus;
}

export interface BaseBatch extends BatchDetailsType {
  created_by: string;
  paper_type?: string;
  paper_weight?: string;
  updated_at: string;
}

export interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: string;
  product_type: string;
  sheets_required: number;
  lamination_type?: string;
  front_pdf_url?: string | null;
  back_pdf_url?: string | null;
  overview_pdf_url?: string | null;
  created_at?: string;
}

export interface Job {
  id: string;
  name: string;
  quantity: number;
  status: string;
  pdf_url: string;
}
