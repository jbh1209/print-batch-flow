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

export enum JobStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ON_HOLD = "ON_HOLD",
  QUEUED = "QUEUED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum BatchStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ON_HOLD = "ON_HOLD",
  QUEUED = "QUEUED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

// Make sure Job type explicitly includes the double_sided property
export interface Job {
  id: string;
  name: string;
  quantity: number;
  status: JobStatus;
  pdf_url: string | null;
  file_name: string;
  lamination_type: string;
  due_date: string;
  uploaded_at: string;
  double_sided?: boolean; // Add this explicit property
}
