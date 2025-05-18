
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

export type ExistingTableName = TableName;

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
  user_id: string;
  pdf_url: string | null;
  file_name: string;
  lamination_type?: LaminationType | string;
  // Additional fields that may be present in some job types
  size?: string;
  paper_type?: string;
  paper_weight?: string;
  sides?: string;
  stock_type?: string;
}

export type JobStatus = 'queued' | 'batched' | 'processing' | 'completed' | 'cancelled';

export interface BaseBatch {
  id: string;
  name: string;
  status: BatchStatus;
  due_date: string;
  sheets_required: number;
  lamination_type: LaminationType | string;
  created_at: string;
  front_pdf_url?: string | null;
  back_pdf_url?: string | null;
  overview_pdf_url?: string | null;
  created_by?: string;
  updated_at?: string;
  date_created?: string;
  sheet_size?: string;
  printer_type?: string;
  paper_type?: string;
  paper_weight?: string;
  sides?: string;
}

export interface ProductConfig {
  productType: string;
  tableName?: TableName;
  ui: {
    title: string;
    newItemTitle?: string;
    editItemTitle?: string;
    description?: string;
    jobFormTitle?: string;
    batchFormTitle?: string;
    icon?: string;
    color?: string;
  };
  routes: {
    basePath: string;
    newJobPath: string;
    jobsPath?: string;
    batchesPath?: string;
    indexPath?: string;
    jobDetailPath?: (id: string) => string;
    jobEditPath?: (id: string) => string;
  };
  jobNumberPrefix?: string;
  availablePaperTypes?: string[];
  availablePaperWeights?: string[];
  availableLaminationTypes?: LaminationType[];
  availablePrinterTypes?: string[];
  availableSheetSizes?: string[];
  availableSizes?: string[];
  availableSidesTypes?: string[];
  availableUVVarnishTypes?: string[];
  hasPaperType?: boolean;
  hasPaperWeight?: boolean;
  hasLamination?: boolean;
  hasSize?: boolean;
  hasSides?: boolean;
  hasUVVarnish?: boolean;
  slaTargetDays: number;
}
