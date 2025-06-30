
export interface FlyerJob {
  id: string;
  user_id: string;
  name: string;
  job_number: string;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  status: string;
  batch_id?: string;
  created_at: string;
  updated_at: string;
  batch_ready?: boolean;
  batch_allocated_at?: string;
  batch_allocated_by?: string;
  // Specifications are now stored separately in job_print_specifications table
  // Legacy fields removed: size, paper_weight, paper_type
}

export type LaminationType = "none" | "gloss" | "matt" | "soft_touch";
