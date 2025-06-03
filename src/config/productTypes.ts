import { JobStatus } from "@/components/business-cards/JobsTable";

// Export all the types that are being imported elsewhere
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled" | "sent_to_print";
export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

// Add missing type exports
export type TableName = string;
export type ExistingTableName = "business_card_jobs" | "flyer_jobs" | "postcard_jobs" | "poster_jobs" | "sleeve_jobs" | "box_jobs" | "cover_jobs" | "sticker_jobs";

export interface ProductConfig {
  productType: string;
  tableName: string;
  hasSize: boolean;
  hasPaperType: boolean;
  hasPaperWeight?: boolean;
  hasLamination?: boolean;
  hasSides?: boolean;
  hasUVVarnish?: boolean;
  slaTargetDays: number;
  ui: {
    color: string;
    title: string;
    batchFormTitle: string;
    jobFormTitle: string;
  };
  fields: {
    [key: string]: {
      label: string;
    };
  };
  routes: {
    jobs: string;
    batches: string;
    newJob: string;
    jobsPath?: string;
    batchesPath?: string;
    newJobPath?: string;
    basePath?: string;
    jobDetailPath?: string | ((id: string) => string);
    jobEditPath?: string | ((id: string) => string);
  };
  availablePaperTypes?: string[];
  availablePaperWeights?: string[];
  availableLaminationTypes?: LaminationType[];
  availableSizes?: string[];
  availableUVVarnishTypes?: string[];
  availableSidesTypes?: string[];
}

export interface BaseJob {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  due_date: string;
  created_at: string;
  status: JobStatus;
  pdf_url: string;
  reference?: string;
  // Optional fields that may exist on some job types
  size?: string;
  paper_type?: string;
  paper_weight?: string;
  lamination_type?: string;
  job_number?: string;
  updated_at?: string;
  user_id?: string;
  double_sided?: boolean;
  uv_varnish?: string;
  sides?: string;
  batch_id?: string;
  stock_type?: string;
}

export interface BaseBatch {
  id: string;
  name: string;
  status: BatchStatus;
  due_date: string;
  created_at: string;
  updated_at?: string;
  sheets_required: number;
  lamination_type: LaminationType;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
  paper_type?: string;
  paper_weight?: string;
  sides?: string;
  created_by?: string;
}

// Product configurations
export const productConfigs: Record<string, ProductConfig> = {
  "BusinessCards": {
    productType: "Business Cards",
    tableName: "business_card_jobs",
    hasSize: false,
    hasPaperType: false,
    slaTargetDays: 3,
    ui: {
      color: "#624cf5",
      title: "Business Cards",
      batchFormTitle: "Create Business Card Batch",
      jobFormTitle: "New Business Card Job"
    },
    fields: {
      lamination_type: { label: "Lamination Type" },
      quantity: { label: "Quantity" }
    },
    routes: {
      jobs: "/batches/business-cards/jobs",
      batches: "/batches/business-cards",
      newJob: "/batches/business-cards/jobs/new",
      jobsPath: "/batches/business-cards/jobs",
      batchesPath: "/batches/business-cards",
      newJobPath: "/batches/business-cards/jobs/new",
      basePath: "/batches/business-cards",
      jobDetailPath: (id: string) => `/batches/business-cards/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/business-cards/jobs/edit/${id}`
    },
    availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"]
  },
  "Flyers": {
    productType: "Flyers",
    tableName: "flyer_jobs",
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasLamination: true,
    slaTargetDays: 5,
    ui: {
      color: "#f54c82",
      title: "Flyers",
      batchFormTitle: "Create Flyer Batch",
      jobFormTitle: "New Flyer Job"
    },
    fields: {
      size: { label: "Size" },
      paper_type: { label: "Paper Type" },
      paper_weight: { label: "Paper Weight" }
    },
    routes: {
      jobs: "/batches/flyers/jobs",
      batches: "/batches/flyers",
      newJob: "/batches/flyers/jobs/new",
      jobsPath: "/batches/flyers/jobs",
      batchesPath: "/batches/flyers",
      newJobPath: "/batches/flyers/jobs/new",
      basePath: "/batches/flyers",
      jobDetailPath: (id: string) => `/batches/flyers/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/flyers/jobs/edit/${id}`
    },
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["130gsm", "150gsm", "200gsm"],
    availableLaminationTypes: ["none", "gloss", "matt"],
    availableSizes: ["A5", "A4", "DL", "A3"]
  },
  "Postcards": {
    productType: "Postcards",
    tableName: "postcard_jobs",
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasLamination: true,
    slaTargetDays: 4,
    ui: {
      color: "#f5a74c",
      title: "Postcards",
      batchFormTitle: "Create Postcard Batch",
      jobFormTitle: "New Postcard Job"
    },
    fields: {
      size: { label: "Size" },
      paper_type: { label: "Paper Type" },
      paper_weight: { label: "Paper Weight" }
    },
    routes: {
      jobs: "/batches/postcards/jobs",
      batches: "/batches/postcards",
      newJob: "/batches/postcards/jobs/new",
      jobsPath: "/batches/postcards/jobs",
      batchesPath: "/batches/postcards",
      newJobPath: "/batches/postcards/jobs/new",
      basePath: "/batches/postcards",
      jobDetailPath: (id: string) => `/batches/postcards/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/postcards/jobs/edit/${id}`
    },
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["300gsm", "350gsm"],
    availableLaminationTypes: ["none", "gloss", "matt"],
    availableSizes: ["A6", "A5"]
  },
  "Posters": {
    productType: "Posters",
    tableName: "poster_jobs",
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasLamination: true,
    slaTargetDays: 7,
    ui: {
      color: "#4cf598",
      title: "Posters",
      batchFormTitle: "Create Poster Batch",
      jobFormTitle: "New Poster Job"
    },
    fields: {
      size: { label: "Size" },
      paper_type: { label: "Paper Type" },
      paper_weight: { label: "Paper Weight" }
    },
    routes: {
      jobs: "/batches/posters/jobs",
      batches: "/batches/posters",
      newJob: "/batches/posters/jobs/new",
      jobsPath: "/batches/posters/jobs",
      batchesPath: "/batches/posters",
      newJobPath: "/batches/posters/jobs/new",
      basePath: "/batches/posters",
      jobDetailPath: (id: string) => `/batches/posters/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/posters/jobs/edit/${id}`
    },
    availablePaperTypes: ["Matt", "Gloss", "Canvas"],
    availablePaperWeights: ["200gsm", "250gsm", "300gsm"],
    availableLaminationTypes: ["none", "gloss", "matt"],
    availableSizes: ["A3", "A2", "A1", "A0"]
  },
  "Sleeves": {
    productType: "Sleeves",
    tableName: "sleeve_jobs",
    hasSize: true,
    hasPaperType: true,
    slaTargetDays: 5,
    ui: {
      color: "#4c87f5",
      title: "Sleeves",
      batchFormTitle: "Create Sleeve Batch",
      jobFormTitle: "New Sleeve Job"
    },
    fields: {
      stock_type: { label: "Stock Type" }
    },
    routes: {
      jobs: "/batches/sleeves/jobs",
      batches: "/batches/sleeves",
      newJob: "/batches/sleeves/jobs/new",
      jobsPath: "/batches/sleeves/jobs",
      batchesPath: "/batches/sleeves",
      newJobPath: "/batches/sleeves/jobs/new",
      basePath: "/batches/sleeves",
      jobDetailPath: (id: string) => `/batches/sleeves/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/sleeves/jobs/edit/${id}`
    },
    availablePaperTypes: ["Premium", "Standard"],
    availablePaperWeights: ["350gsm"],
    availableLaminationTypes: ["none"]
  },
  "Boxes": {
    productType: "Boxes",
    tableName: "box_jobs",
    hasSize: true,
    hasPaperType: true,
    hasLamination: true,
    slaTargetDays: 10,
    ui: {
      color: "#f54cca",
      title: "Boxes",
      batchFormTitle: "Create Box Batch",
      jobFormTitle: "New Box Job"
    },
    fields: {
      paper_type: { label: "Paper Type" },
      lamination_type: { label: "Lamination Type" }
    },
    routes: {
      jobs: "/batches/boxes/jobs",
      batches: "/batches/boxes",
      newJob: "/batches/boxes/jobs/new",
      jobsPath: "/batches/boxes/jobs",
      batchesPath: "/batches/boxes",
      newJobPath: "/batches/boxes/jobs/new",
      basePath: "/batches/boxes",
      jobDetailPath: (id: string) => `/batches/boxes/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/boxes/jobs/edit/${id}`
    },
    availablePaperTypes: ["Cardboard", "Corrugated"],
    availablePaperWeights: ["300gsm", "400gsm", "500gsm"],
    availableLaminationTypes: ["none", "gloss", "matt"]
  },
  "Covers": {
    productType: "Covers",
    tableName: "cover_jobs",
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasLamination: true,
    hasSides: true,
    hasUVVarnish: true,
    slaTargetDays: 6,
    ui: {
      color: "#caf54c",
      title: "Covers",
      batchFormTitle: "Create Cover Batch",
      jobFormTitle: "New Cover Job"
    },
    fields: {
      paper_type: { label: "Paper Type" },
      paper_weight: { label: "Paper Weight" },
      lamination_type: { label: "Lamination Type" },
      uv_varnish: { label: "UV Varnish" },
      sides: { label: "Sides" }
    },
    routes: {
      jobs: "/batches/covers/jobs",
      batches: "/batches/covers",
      newJob: "/batches/covers/jobs/new",
      jobsPath: "/batches/covers/jobs",
      batchesPath: "/batches/covers",
      newJobPath: "/batches/covers/jobs/new",
      basePath: "/batches/covers",
      jobDetailPath: (id: string) => `/batches/covers/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/covers/jobs/edit/${id}`
    },
    availablePaperTypes: ["Matt", "Gloss", "Textured"],
    availablePaperWeights: ["250gsm", "300gsm", "350gsm"],
    availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"],
    availableUVVarnishTypes: ["none", "spot", "flood"],
    availableSidesTypes: ["single", "double"]
  },
  "Stickers": {
    productType: "Stickers",
    tableName: "sticker_jobs",
    hasSize: true,
    hasPaperType: true,
    hasLamination: true,
    slaTargetDays: 4,
    ui: {
      color: "#4cf5f0",
      title: "Stickers",
      batchFormTitle: "Create Sticker Batch",
      jobFormTitle: "New Sticker Job"
    },
    fields: {
      paper_type: { label: "Paper Type" },
      lamination_type: { label: "Lamination Type" }
    },
    routes: {
      jobs: "/batches/stickers/jobs",
      batches: "/batches/stickers",
      newJob: "/batches/stickers/jobs/new",
      jobsPath: "/batches/stickers/jobs",
      batchesPath: "/batches/stickers",
      newJobPath: "/batches/stickers/jobs/new",
      basePath: "/batches/stickers",
      jobDetailPath: (id: string) => `/batches/stickers/jobs/${id}`,
      jobEditPath: (id: string) => `/batches/stickers/jobs/edit/${id}`
    },
    availablePaperTypes: ["Vinyl", "Paper", "Clear"],
    availablePaperWeights: ["80gsm", "100gsm"],
    availableLaminationTypes: ["none", "gloss", "matt"]
  }
};

// Export JobStatus from the original location to maintain compatibility
export type { JobStatus };
