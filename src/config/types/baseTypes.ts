
/**
 * This file contains base types for the system
 */

// Type for existing database tables
export type ExistingTableName = 
  | 'flyer_jobs'
  | 'postcard_jobs'
  | 'business_card_jobs'
  | 'poster_jobs'
  | 'sleeve_jobs'
  | 'box_jobs'
  | 'cover_jobs'
  | 'sticker_jobs'
  | 'batches'
  | 'profiles'
  | 'user_roles';

// Status types for jobs and batches
export type BatchStatus = 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'sent_to_print'
  | 'cancelled';

export interface BaseBatch {
  id: string;
  name: string;
  status: BatchStatus;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  due_date: string;
  created_at: string;
  lamination_type?: string;
  paper_type?: string;
  paper_weight?: string;
  sides?: string;
  created_by?: string;
  updated_at?: string;
  date_created?: string;
  sheet_size?: string;
  printer_type?: string;
}

export interface BaseJob {
  id: string;
  name?: string;
  status: string;
  quantity: number;
  due_date: string;
  created_at?: string;
  updated_at?: string;
  lamination_type?: string;
  paper_type?: string;
  paper_weight?: string;
  pdf_url?: string;
  file_name?: string;
  batch_id?: string | null;
}
