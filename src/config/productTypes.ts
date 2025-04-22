import { SupabaseClient } from "@supabase/supabase-js";

export type TableName = 
  | "flyer_jobs" 
  | "postcard_jobs" 
  | "business_card_jobs"
  | "poster_jobs"
  | "batches"
  | "profiles"
  | "user_roles";

export type JobStatus = "queued" | "processing" | "batched" | "printing" | "completed" | "error";
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled";
export type LaminationType = "none" | "matt" | "gloss" | "soft_touch";

export interface ProductConfig {
  productType: string;
  tableName: TableName;
  ui: {
    title: string;
    jobFormTitle: string;
    batchFormTitle: string;
  };
  routes: {
    basePath: string;
    jobsPath: string;
    newJobPath: string;
    batchesPath: string;
  };
  hasSize?: boolean;
  hasPaperType?: boolean;
  hasPaperWeight?: boolean;
  availableSizes?: string[];
  availablePaperTypes?: string[];
  availablePaperWeights?: string[];
}

export interface BaseJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  size?: string;
  paper_type?: string;
  paper_weight?: string;
  due_date: string;
  pdf_url: string;
  file_name: string;
  user_id: string;
  status: JobStatus;
  created_at: string;
  batch_id?: string | null;
  lamination_type?: LaminationType;
}

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
  lamination_type?: LaminationType;
  paper_type?: string;
  paper_weight?: string;
  updated_at: string;
}

export const productConfigs: Record<string, ProductConfig> = {
  "Business Cards": {
    productType: "Business Cards",
    tableName: "business_card_jobs",
    ui: {
      title: "Business Cards",
      jobFormTitle: "Business Card",
      batchFormTitle: "Business Card"
    },
    routes: {
      basePath: "/batches/business-cards",
      jobsPath: "/batches/business-cards/jobs",
      newJobPath: "/batches/business-cards/jobs/new",
      batchesPath: "/batches/business-cards/batches"
    },
    hasSize: false,
    hasPaperType: true,
    hasPaperWeight: true,
    availablePaperTypes: ["gloss", "matte", "linen", "recycled"],
    availablePaperWeights: ["14pt", "16pt"],
  },
  "Flyers": {
    productType: "Flyers",
    tableName: "flyer_jobs",
    ui: {
      title: "Flyers",
      jobFormTitle: "Flyer",
      batchFormTitle: "Flyer"
    },
    routes: {
      basePath: "/batches/flyers",
      jobsPath: "/batches/flyers/jobs",
      newJobPath: "/batches/flyers/jobs/new",
      batchesPath: "/batches/flyers/batches"
    },
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    availableSizes: ["A6", "A5", "A4", "A3", "DL"],
    availablePaperTypes: ["gloss", "matte", "silk", "uncoated"],
    availablePaperWeights: ["130gsm", "170gsm", "250gsm", "300gsm", "350gsm"],
  },
  "Postcards": {
    productType: "Postcards",
    tableName: "postcard_jobs",
    ui: {
      title: "Postcards",
      jobFormTitle: "Postcard",
      batchFormTitle: "Postcard"
    },
    routes: {
      basePath: "/batches/postcards",
      jobsPath: "/batches/postcards/jobs",
      newJobPath: "/batches/postcards/jobs/new",
      batchesPath: "/batches/postcards/batches"
    },
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    availableSizes: ["A6", "A5", "A4", "DL"],
    availablePaperTypes: ["gloss", "matte", "silk", "uncoated"],
    availablePaperWeights: ["250gsm", "300gsm", "350gsm", "400gsm"],
  },
  "Posters": {
    productType: "Posters",
    tableName: "poster_jobs",
    ui: {
      title: "Posters",
      jobFormTitle: "Poster",
      batchFormTitle: "Poster"
    },
    routes: {
      basePath: "/batches/posters",
      jobsPath: "/batches/posters/jobs",
      newJobPath: "/batches/posters/jobs/new",
      batchesPath: "/batches/posters/batches"
    },
    hasSize: true,
    availableSizes: ["A3", "A2", "A1", "A0"],
  },
  "Stickers": {
    productType: "Stickers",
    tableName: "sticker_jobs",
    ui: {
      title: "Stickers",
      jobFormTitle: "Sticker",
      batchFormTitle: "Sticker"
    },
    routes: {
      basePath: "/batches/stickers",
      jobsPath: "/batches/stickers/jobs",
      newJobPath: "/batches/stickers/jobs/new",
      batchesPath: "/batches/stickers/batches"
    },
    hasSize: true,
    availableSizes: ["A3", "A2", "A1", "A0"],
  },
  "Sleeves": {
    productType: "Sleeves",
    tableName: "sleeve_jobs",
    ui: {
      title: "Sleeves",
      jobFormTitle: "Sleeve",
      batchFormTitle: "Sleeve"
    },
    routes: {
      basePath: "/batches/sleeves",
      jobsPath: "/batches/sleeves/jobs",
      newJobPath: "/batches/sleeves/jobs/new",
      batchesPath: "/batches/sleeves/batches"
    },
  },
  "Boxes": {
    productType: "Boxes",
    tableName: "box_jobs",
    ui: {
      title: "Boxes",
      jobFormTitle: "Box",
      batchFormTitle: "Box"
    },
    routes: {
      basePath: "/batches/boxes",
      jobsPath: "/batches/boxes/jobs",
      newJobPath: "/batches/boxes/jobs/new",
      batchesPath: "/batches/boxes/batches"
    },
  },
  "Covers": {
    productType: "Covers",
    tableName: "cover_jobs",
    ui: {
      title: "Covers",
      jobFormTitle: "Cover",
      batchFormTitle: "Cover"
    },
    routes: {
      basePath: "/batches/covers",
      jobsPath: "/batches/covers/jobs",
      newJobPath: "/batches/covers/jobs/new",
      batchesPath: "/batches/covers/batches"
    },
  },
};
