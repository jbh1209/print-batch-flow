
export interface FlyerJob {
  id: string;
  name: string;
  job_number: string;
  size: string;
  paper_weight: string;
  paper_type: string;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  user_id: string;
  status: string; // Changed from specific union type to string
  batch_id?: string | null;
  created_at: string;
  updated_at: string;
  batch_ready?: boolean;
  batch_allocated_at?: string | null;
  batch_allocated_by?: string | null;
}

export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

export interface BatchProperties {
  paperType: string;
  paperWeight: string;
  laminationType: LaminationType;
  printerType: string;
  sheetSize: string;
  slaTargetDays: number;
}

export interface FlyerBatch {
  id: string;
  name: string;
  status: string;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  due_date: string;
  created_at: string;
  lamination_type: LaminationType | null;
  paper_type: string;
  paper_weight: string;
  sheet_size: string;
  printer_type: string;
  created_by: string;
  updated_at: string;
  date_created: string;
}
