
export interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  lamination_type: string;
  due_date: string;
  uploaded_at: string;
  status: string;
  pdf_url: string;
  double_sided?: boolean;
  // Add required fields from BaseJob
  updated_at: string;
  user_id: string;
  job_number?: string;
  created_at?: string;
}

// Define the valid batch status types
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'sent_to_print' | 'cancelled';

export interface BatchSummary {
  id: string;
  name: string;
  product_type: string;
  status: string;
  created_at: string;
  due_date: string;
  // Make these required fields
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
}

export interface BatchDetailsType {
  id: string;
  name: string;
  lamination_type: string;
  sheets_required: number;
  due_date: string;
  created_at: string;
  status: BatchStatus; // Using the defined BatchStatus type
  front_pdf_url?: string | null;
  back_pdf_url?: string | null;
  overview_pdf_url?: string | null; // This is derived from back_pdf_url
}
