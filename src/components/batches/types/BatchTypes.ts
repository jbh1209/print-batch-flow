// Define the status type to match what's in the database
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled";

export interface BatchDetailsType {
  id: string;
  name: string;
  lamination_type: LaminationType;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: BatchStatus;
}

export interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: string;
  product_type: string;
  sheets_required: number;
}

export interface Job {
  id: string;
  name: string;
  quantity: number;
  status: string;
  pdf_url: string;
}

export type LaminationType = "none" | "matt" | "gloss";

