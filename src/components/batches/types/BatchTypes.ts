
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
  status: BatchStatus;
}

// Align with the enum used in config/productTypes.ts for consistency
export enum JobStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  ON_HOLD = "on_hold",
  QUEUED = "queued",
  BATCHED = "batched",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  SENT_TO_PRINT = "sent_to_print",
  PROCESSING = "processing"
}

// Align with the enum used in config/productTypes.ts for consistency
export enum BatchStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  ON_HOLD = "on_hold",
  QUEUED = "queued",
  BATCHED = "batched",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  SENT_TO_PRINT = "sent_to_print",
  PROCESSING = "processing"
}

// Add the missing BatchSummary interface
export interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: string;
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
  status: string | JobStatus;
  pdf_url: string | null;
  file_name: string;
  lamination_type: string;
  due_date: string;
  uploaded_at: string;
  double_sided?: boolean;
  // Add missing properties required by several components
  job_number?: string;
  updated_at?: string;
  user_id?: string;
}
