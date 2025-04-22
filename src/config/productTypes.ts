import { z } from "zod";

// Shared types
export type ProductType = 
  | "Flyers" 
  | "Postcards" 
  | "Posters" 
  | "Stickers" 
  | "Sleeves" 
  | "Boxes" 
  | "Covers";

// Database table names for each product type
export const productTableMap: Record<ProductType, string> = {
  "Flyers": "flyer_jobs",
  "Postcards": "postcard_jobs",
  "Posters": "poster_jobs",
  "Stickers": "sticker_jobs",
  "Sleeves": "sleeve_jobs",
  "Boxes": "box_jobs",
  "Covers": "cover_jobs"
};

// Base job status type
export type JobStatus = "queued" | "batched" | "completed" | "cancelled";

// Base lamination type
export type LaminationType = "none" | "matt" | "gloss" | "soft_touch";

// Base batch status type
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled";

// Explicitly define allowed table names based on Supabase schema
export type TableName = "flyer_jobs" | "postcard_jobs" | "poster_jobs" | "sticker_jobs" | "sleeve_jobs" | "box_jobs" | "cover_jobs" | "batches";

// Base job interface that all product job types will extend
export interface BaseJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  batch_id?: string;
  status: JobStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
  // Make these optional since they're specific to certain product types
  size?: string;
  paper_type?: string;
  paper_weight?: string;
}

// Base batch interface
export interface BaseBatch {
  id: string;
  name: string;
  status: BatchStatus;
  sheets_required: number;
  created_at: string;
  due_date: string;
  created_by: string;
  updated_at?: string;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  lamination_type: LaminationType;
  paper_type?: string;
  paper_weight?: string;
}

// Configuration for route paths
export interface ProductRouteConfig {
  basePath: string;
  jobsPath: string;
  batchesPath: string;
  newJobPath: string;
  jobDetailPath: (jobId: string) => string;
  jobEditPath: (jobId: string) => string;
  batchDetailPath: (batchId: string) => string;
}

// Configuration for form fields and UI
export interface ProductFormConfig {
  title: string;
  jobFormTitle: string;
  batchFormTitle: string;
  icon: string;
}

// Product-specific configuration registry
export interface ProductConfig {
  productType: ProductType;
  tableName: TableName; // Use our explicitly defined TableName type
  routes: ProductRouteConfig;
  ui: ProductFormConfig;
  hasLamination: boolean;
  hasPaperType: boolean;
  hasPaperWeight: boolean;
  hasSize: boolean;
  defaultSize?: string;
  availableSizes: string[];
  availablePaperTypes: string[];
  availablePaperWeights: string[];
  availableLaminationTypes: LaminationType[];
}

// This is the main registry of all product configurations
export const productConfigs: Record<ProductType, ProductConfig> = {
  "Flyers": {
    productType: "Flyers",
    tableName: "flyer_jobs",
    routes: {
      basePath: "/batches/flyers",
      jobsPath: "/batches/flyers/jobs",
      batchesPath: "/batches/flyers/batches",
      newJobPath: "/batches/flyers/jobs/new",
      jobDetailPath: (jobId) => `/batches/flyers/jobs/${jobId}`,
      jobEditPath: (jobId) => `/batches/flyers/jobs/${jobId}/edit`,
      batchDetailPath: (batchId) => `/batches/flyers/batches/${batchId}`
    },
    ui: {
      title: "Flyers",
      jobFormTitle: "Flyer Job",
      batchFormTitle: "Flyer Batch",
      icon: "FileText"
    },
    hasLamination: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSize: true,
    availableSizes: ["A5", "A4", "DL", "A3"],
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm"],
    availableLaminationTypes: ["none", "matt", "gloss", "soft_touch"]
  },
  "Postcards": {
    productType: "Postcards",
    tableName: "postcard_jobs",
    routes: {
      basePath: "/batches/postcards",
      jobsPath: "/batches/postcards/jobs",
      batchesPath: "/batches/postcards/batches",
      newJobPath: "/batches/postcards/jobs/new",
      jobDetailPath: (jobId) => `/batches/postcards/jobs/${jobId}`,
      jobEditPath: (jobId) => `/batches/postcards/jobs/${jobId}/edit`,
      batchDetailPath: (batchId) => `/batches/postcards/batches/${batchId}`
    },
    ui: {
      title: "Postcards",
      jobFormTitle: "Postcard Job",
      batchFormTitle: "Postcard Batch",
      icon: "Image"
    },
    hasLamination: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSize: true,
    defaultSize: "A6",
    availableSizes: ["A6", "A5", "DL"],
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["300gsm", "350gsm", "400gsm"],
    availableLaminationTypes: ["none", "matt", "gloss"]
  },
  "Posters": {
    productType: "Posters",
    tableName: "poster_jobs",
    routes: {
      basePath: "/batches/posters",
      jobsPath: "/batches/posters/jobs",
      batchesPath: "/batches/posters/batches",
      newJobPath: "/batches/posters/jobs/new",
      jobDetailPath: (jobId) => `/batches/posters/jobs/${jobId}`,
      jobEditPath: (jobId) => `/batches/posters/jobs/${jobId}/edit`,
      batchDetailPath: (batchId) => `/batches/posters/batches/${batchId}`
    },
    ui: {
      title: "Posters",
      jobFormTitle: "Poster Job",
      batchFormTitle: "Poster Batch",
      icon: "ImagePlus"
    },
    hasLamination: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSize: true,
    availableSizes: ["A2", "A1", "A0"],
    availablePaperTypes: ["Matt", "Gloss", "Satin"],
    availablePaperWeights: ["170gsm", "200gsm"],
    availableLaminationTypes: ["none", "matt", "gloss"]
  },
  "Stickers": {
    productType: "Stickers",
    tableName: "sticker_jobs",
    routes: {
      basePath: "/batches/stickers",
      jobsPath: "/batches/stickers/jobs",
      batchesPath: "/batches/stickers/batches",
      newJobPath: "/batches/stickers/jobs/new",
      jobDetailPath: (jobId) => `/batches/stickers/jobs/${jobId}`,
      jobEditPath: (jobId) => `/batches/stickers/jobs/${jobId}/edit`,
      batchDetailPath: (batchId) => `/batches/stickers/batches/${batchId}`
    },
    ui: {
      title: "Stickers",
      jobFormTitle: "Sticker Job",
      batchFormTitle: "Sticker Batch",
      icon: "Sticker"
    },
    hasLamination: false,
    hasPaperType: false,
    hasPaperWeight: false,
    hasSize: true,
    availableSizes: ["Custom", "A4", "A3"],
    availablePaperTypes: [],
    availablePaperWeights: [],
    availableLaminationTypes: ["none"]
  },
  "Sleeves": {
    productType: "Sleeves",
    tableName: "sleeve_jobs",
    routes: {
      basePath: "/batches/sleeves",
      jobsPath: "/batches/sleeves/jobs",
      batchesPath: "/batches/sleeves/batches",
      newJobPath: "/batches/sleeves/jobs/new",
      jobDetailPath: (jobId) => `/batches/sleeves/jobs/${jobId}`,
      jobEditPath: (jobId) => `/batches/sleeves/jobs/${jobId}/edit`,
      batchDetailPath: (batchId) => `/batches/sleeves/batches/${batchId}`
    },
    ui: {
      title: "Box Sleeves",
      jobFormTitle: "Box Sleeve Job",
      batchFormTitle: "Box Sleeve Batch",
      icon: "Package"
    },
    hasLamination: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSize: true,
    availableSizes: ["Small", "Medium", "Large", "Custom"],
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["250gsm", "300gsm", "350gsm"],
    availableLaminationTypes: ["none", "matt", "gloss"]
  },
  "Boxes": {
    productType: "Boxes",
    tableName: "box_jobs",
    routes: {
      basePath: "/batches/boxes",
      jobsPath: "/batches/boxes/jobs",
      batchesPath: "/batches/boxes/batches",
      newJobPath: "/batches/boxes/jobs/new",
      jobDetailPath: (jobId) => `/batches/boxes/jobs/${jobId}`,
      jobEditPath: (jobId) => `/batches/boxes/jobs/${jobId}/edit`,
      batchDetailPath: (batchId) => `/batches/boxes/batches/${batchId}`
    },
    ui: {
      title: "Product Boxes",
      jobFormTitle: "Product Box Job",
      batchFormTitle: "Product Box Batch",
      icon: "Box"
    },
    hasLamination: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSize: true,
    availableSizes: ["Small", "Medium", "Large", "Custom"],
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["300gsm", "350gsm", "400gsm"],
    availableLaminationTypes: ["matt", "gloss", "soft_touch"]
  },
  "Covers": {
    productType: "Covers",
    tableName: "cover_jobs",
    routes: {
      basePath: "/batches/covers",
      jobsPath: "/batches/covers/jobs",
      batchesPath: "/batches/covers/batches",
      newJobPath: "/batches/covers/jobs/new",
      jobDetailPath: (jobId) => `/batches/covers/jobs/${jobId}`,
      jobEditPath: (jobId) => `/batches/covers/jobs/${jobId}/edit`,
      batchDetailPath: (batchId) => `/batches/covers/batches/${batchId}`
    },
    ui: {
      title: "Book Covers",
      jobFormTitle: "Book Cover Job",
      batchFormTitle: "Book Cover Batch",
      icon: "BookOpen"
    },
    hasLamination: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSize: true,
    availableSizes: ["A5", "A4", "Custom"],
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["250gsm", "300gsm", "350gsm"],
    availableLaminationTypes: ["matt", "gloss", "soft_touch"]
  }
};

// Helper to get config by product type
export const getProductConfig = (productType: ProductType): ProductConfig => {
  return productConfigs[productType];
};
