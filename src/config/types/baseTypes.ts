export type BatchStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'sent_to_print'
  | 'completed'
  | 'cancelled';

export type TableName =
  | 'business_card_jobs'
  | 'flyer_jobs'
  | 'postcard_jobs'
  | 'box_jobs'
  | 'sticker_jobs'
  | 'cover_jobs'
  | 'poster_jobs'
  | 'sleeve_jobs';

export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

/**
 * Base properties that all job types share
 */
export interface BaseJob {
  id: string;
  name: string;
  job_number: string;
  status: JobStatus;
  quantity: number;
  due_date: string;
  created_at: string;
  updated_at?: string;
  batch_id?: string | null;
  user_id: string;  // Added this missing field
  pdf_url: string | null;
  file_name: string;
  lamination_type?: string;
}

export interface ProductConfig {
  productType: string;
  tableName?: TableName;
  ui: {
    title: string;
    newItemTitle: string;
    editItemTitle: string;
    description: string;
  };
  routes: {
    basePath: string;
    newJobPath: string;
    jobDetailPath?: (id: string) => string;
  };
  availablePaperTypes: string[];
  availablePaperWeights: string[];
  availableLaminationTypes: LaminationType[];
  availablePrinterTypes: string[];
  availableSheetSizes: string[];
  slaTargetDays: number;
}
