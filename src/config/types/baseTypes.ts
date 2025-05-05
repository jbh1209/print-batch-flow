
// Base type definitions for the product system

export type LaminationType = 'none' | 'matt' | 'gloss' | 'soft_touch';
export type JobStatus = 'queued' | 'batched' | 'completed' | 'error' | 'cancelled';
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'sent_to_print';
export type TableName = string;
export type UVVarnishType = 'none' | 'gloss';
export type ExistingTableName = 'flyer_jobs' | 'postcard_jobs' | 'business_card_jobs' | 'poster_jobs' | 'sleeve_jobs' | 'box_jobs' | 'cover_jobs' | 'sticker_jobs' | 'batches' | 'profiles' | 'user_roles';

// Base interfaces
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
  created_by: string;
  lamination_type: LaminationType;
  paper_type?: string;
  paper_weight?: string;
  updated_at?: string;
  sides?: string;
  uv_varnish?: UVVarnishType;
}

export interface BaseJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  due_date: string;
  status: JobStatus | string;
  user_id: string;
  batch_id?: string | null;
  pdf_url: string;
  file_name: string;
  created_at: string;
  updated_at: string;
  paper_type?: string;
  paper_weight?: string;
  lamination_type?: LaminationType;
  size?: string;
  sides?: string;
  stock_type?: string;
  single_sided?: boolean;
  uv_varnish?: UVVarnishType;
}
