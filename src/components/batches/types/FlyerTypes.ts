
// Import existing type definitions
import { BatchStatus } from './BatchTypes';

export type FlyerSize = 'A5' | 'A4' | 'DL' | 'A3';
export type PaperType = 'Matt' | 'Gloss';
export type PrinterType = 'HP 12000' | 'HP 7900';
export type SheetSize = '455x640mm' | '530x750mm' | '320x455mm';
export type JobStatus = 'queued' | 'batched' | 'completed' | 'cancelled';

export interface FlyerJob {
  id: string;
  name: string;
  job_number: string;
  size: FlyerSize;
  paper_weight: string;
  paper_type: PaperType;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  batch_id: string | null;
  status: JobStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface FlyerBatch {
  id: string;
  name: string;
  paper_weight: string | null;
  paper_type: string | null;
  printer_type: PrinterType;
  sheet_size: SheetSize;
  due_date: string;
  created_at: string;
  status: BatchStatus;
  sheets_required: number;
}
