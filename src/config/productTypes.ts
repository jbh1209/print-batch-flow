
import { JobStatus } from "@/components/business-cards/JobsTable";

// Export all the types that are being imported elsewhere
export type BatchStatus = "pending" | "processing" | "completed" | "cancelled" | "sent_to_print";
export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

export interface ProductConfig {
  productType: string;
  tableName: string;
  hasSize: boolean;
  hasPaperType: boolean;
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
  };
  availablePaperTypes?: string[];
  availablePaperWeights?: string[];
  availableLaminationTypes?: LaminationType[];
  availableSizes?: string[];
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
}

export interface BaseBatch {
  id: string;
  name: string;
  status: BatchStatus;
  due_date: string;
  created_at: string;
  sheets_required: number;
  lamination_type: LaminationType;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  overview_pdf_url: string | null;
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
      newJob: "/batches/business-cards/jobs/new"
    },
    availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"]
  },
  "Flyers": {
    productType: "Flyers",
    tableName: "flyer_jobs",
    hasSize: true,
    hasPaperType: true,
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
      newJob: "/batches/flyers/jobs/new"
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
      newJob: "/batches/postcards/jobs/new"
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
      newJob: "/batches/posters/jobs/new"
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
      newJob: "/batches/sleeves/jobs/new"
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
      newJob: "/batches/boxes/jobs/new"
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
      newJob: "/batches/covers/jobs/new"
    },
    availablePaperTypes: ["Matt", "Gloss", "Textured"],
    availablePaperWeights: ["250gsm", "300gsm", "350gsm"],
    availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"]
  },
  "Stickers": {
    productType: "Stickers",
    tableName: "sticker_jobs",
    hasSize: true,
    hasPaperType: true,
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
      newJob: "/batches/stickers/jobs/new"
    },
    availablePaperTypes: ["Vinyl", "Paper", "Clear"],
    availablePaperWeights: ["80gsm", "100gsm"],
    availableLaminationTypes: ["none", "gloss", "matt"]
  }
};

// Export JobStatus from the original location to maintain compatibility
export { JobStatus };
