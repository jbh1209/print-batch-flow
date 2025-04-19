
export type PostcardSize = "A6";
export type PaperType = "350gsm Matt" | "350gsm Gloss";
export type LaminationType = "matt" | "gloss" | "soft_touch" | "none";
export type JobStatus = "queued" | "batched" | "completed" | "cancelled";
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled";

export interface PostcardJob {
  id: string;
  name: string;
  job_number: string;
  size: PostcardSize;
  paper_type: PaperType;
  paper_weight: string; // Changed from optional to required to match DB schema
  lamination_type: LaminationType;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  batch_id?: string;
  status: JobStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PostcardBatch {
  id: string;
  name: string;
  status: BatchStatus;
  paper_type: PaperType;
  lamination_type: LaminationType;
  created_at: string;
  due_date: string;
  sheets_required: number;
  created_by: string;
  updated_at?: string;
  front_pdf_url?: string;
  back_pdf_url?: string;
}

export interface PostcardBatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: BatchStatus;
  product_type: "Postcards";
  sheets_required: number;
  lamination_type?: LaminationType;
  front_pdf_url?: string | null;
  back_pdf_url?: string | null;
  created_at?: string;
}

export interface PostcardPreviewProps {
  jobs: PostcardJob[];
  previewScale?: number;
  onClose?: () => void;
}

export interface PostcardBatchProps {
  batch: PostcardBatch;
  onRefresh?: () => void;
}
