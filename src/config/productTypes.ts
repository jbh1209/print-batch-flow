export type LaminationType = 'none' | 'matt' | 'gloss' | 'soft_touch';
export type JobStatus = 'queued' | 'batched' | 'completed' | 'error' | 'cancelled';
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'sent_to_print';
export type TableName = string;
export type UVVarnishType = 'none' | 'gloss';
export type ExistingTableName = 'flyer_jobs' | 'postcard_jobs' | 'business_card_jobs' | 'poster_jobs' | 'sleeve_jobs' | 'box_jobs' | 'cover_jobs' | 'sticker_jobs' | 'batches' | 'profiles' | 'user_roles';

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

export interface ProductConfig {
  productType: string;
  tableName: TableName;
  jobNumberPrefix?: string;
  availablePaperTypes?: string[];
  availableLaminationTypes?: LaminationType[];
  availablePaperWeights?: string[];
  availableSizes?: string[];
  availableSidesTypes?: string[];
  availableUVVarnishTypes?: UVVarnishType[];
  hasSize?: boolean;
  hasPaperType?: boolean;
  hasPaperWeight?: boolean;
  hasLamination?: boolean;
  hasSides?: boolean;
  hasUVVarnish?: boolean;
  slaTargetDays: number;
  routes: {
    indexPath: string;
    jobsPath: string;
    newJobPath: string;
    batchesPath: string;
    basePath?: string;
    jobDetailPath?: (id: string) => string;
    jobEditPath?: (id: string) => string;
  };
  ui: {
    icon: string;
    color: string;
    jobFormTitle: string;
    title?: string;
    batchFormTitle?: string;
  };
}

export const productConfigs: Record<string, ProductConfig> = {
  "BusinessCards": {
    productType: "BusinessCards",
    tableName: "business_card_jobs",
    jobNumberPrefix: "BC",
    availablePaperTypes: ["350gsm Matt", "350gsm Silk", "400gsm Matt", "400gsm Silk"],
    availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"],
    hasPaperType: true,
    hasLamination: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/business-cards",
      jobsPath: "/batches/business-cards/jobs",
      newJobPath: "/batches/business-cards/jobs/new",
      batchesPath: "/batches/business-cards/batches",
      basePath: "/batches/business-cards",
      jobDetailPath: (id) => `/batches/business-cards/jobs/${id}`,
      jobEditPath: (id) => `/batches/business-cards/jobs/${id}/edit`,
    },
    ui: {
      icon: "card",
      color: "blue",
      jobFormTitle: "Business Card Job",
      title: "Business Cards",
      batchFormTitle: "Business Card Batch"
    }
  },
  "Flyers": {
    productType: "Flyers",
    tableName: "flyer_jobs",
    jobNumberPrefix: "FL",
    availableSizes: ["A6", "A5", "A4", "DL"],
    availablePaperTypes: ["Gloss", "Silk", "Uncoated"],
    availablePaperWeights: ["115gsm", "130gsm", "170gsm", "250gsm", "300gsm", "350gsm"],
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/flyers",
      jobsPath: "/batches/flyers/jobs",
      newJobPath: "/batches/flyers/jobs/new",
      batchesPath: "/batches/flyers/batches",
      basePath: "/batches/flyers",
      jobDetailPath: (id) => `/batches/flyers/jobs/${id}`,
      jobEditPath: (id) => `/batches/flyers/jobs/${id}/edit`,
    },
    ui: {
      icon: "package",
      color: "orange",
      jobFormTitle: "Flyer Job",
      title: "Flyers",
      batchFormTitle: "Flyer Batch"
    }
  },
   "Postcards": {
    productType: "Postcards",
    tableName: "postcard_jobs",
    jobNumberPrefix: "PC",
    availableSizes: ["A6", "A5", "A4", "DL"],
    availablePaperTypes: ["Gloss", "Silk", "Uncoated"],
    availablePaperWeights: ["115gsm", "130gsm", "170gsm", "250gsm", "300gsm", "350gsm"],
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/postcards",
      jobsPath: "/batches/postcards/jobs",
      newJobPath: "/batches/postcards/jobs/new",
      batchesPath: "/batches/postcards/batches",
      basePath: "/batches/postcards",
      jobDetailPath: (id) => `/batches/postcards/jobs/${id}`,
      jobEditPath: (id) => `/batches/postcards/jobs/${id}/edit`,
    },
    ui: {
      icon: "mail",
      color: "amber",
      jobFormTitle: "Postcard Job",
      title: "Postcards",
      batchFormTitle: "Postcard Batch"
    }
  },
  "Sleeves": {
    productType: "Sleeves",
    tableName: "sleeve_jobs",
    jobNumberPrefix: "SL",
    availablePaperTypes: ["Kraft", "White"],
    hasPaperType: true,
    slaTargetDays: 5,
    routes: {
      indexPath: "/batches/sleeves",
      jobsPath: "/batches/sleeves/jobs",
      newJobPath: "/batches/sleeves/jobs/new",
      batchesPath: "/batches/sleeves/batches",
      basePath: "/batches/sleeves",
      jobDetailPath: (id) => `/batches/sleeves/jobs/${id}`,
      jobEditPath: (id) => `/batches/sleeves/jobs/${id}/edit`,
    },
    ui: {
      icon: "box",
      color: "violet",
      jobFormTitle: "Sleeve Job",
      title: "Sleeves",
      batchFormTitle: "Sleeve Batch"
    }
  },
  "Stickers": {
    productType: "Stickers",
    tableName: "sticker_jobs",
    jobNumberPrefix: "STK",
    availablePaperTypes: ["Paper", "Vinyl"],
    availableLaminationTypes: ["none", "matt", "gloss"],
    hasPaperType: true,
    hasLamination: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/stickers",
      jobsPath: "/batches/stickers/jobs",
      newJobPath: "/batches/stickers/jobs/new",
      batchesPath: "/batches/stickers/batches",
      basePath: "/batches/stickers",
      jobDetailPath: (id) => `/batches/stickers/jobs/${id}`,
      jobEditPath: (id) => `/batches/stickers/jobs/${id}/edit`,
    },
    ui: {
      icon: "sticker",
      color: "emerald",
      jobFormTitle: "Sticker Job",
      title: "Stickers",
      batchFormTitle: "Sticker Batch"
    }
  },
  "Posters": {
    productType: "Posters",
    tableName: "poster_jobs",
    jobNumberPrefix: "POST",
    availableSizes: ["A4", "A3"],
    availablePaperTypes: ["Matt", "Gloss"],
    availableSidesTypes: ["single", "double"],
    hasSize: true,
    hasPaperType: true,
    hasSides: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/posters",
      jobsPath: "/batches/posters/jobs",
      newJobPath: "/batches/posters/jobs/new",
      batchesPath: "/batches/posters/batches",
      basePath: "/batches/posters",
      jobDetailPath: (id) => `/batches/posters/jobs/${id}`,
      jobEditPath: (id) => `/batches/posters/jobs/${id}/edit`,
    },
    ui: {
      icon: "image",
      color: "pink",
      jobFormTitle: "Poster Job",
      title: "Posters",
      batchFormTitle: "Poster Batch"
    }
  },
  "Covers": {
    productType: "Covers",
    tableName: "cover_jobs",
    jobNumberPrefix: "COV",
    availableSizes: ["A5", "A4"],
    availablePaperTypes: [
      "250gsm Gloss", 
      "250gsm Matt", 
      "300gsm Gloss", 
      "300gsm Matt",
      "FBB"
    ],
    availablePaperWeights: ["230gsm", "250gsm", "300gsm"],
    availableLaminationTypes: ["none", "matt", "gloss"],
    availableUVVarnishTypes: ["none", "gloss"],
    availableSidesTypes: ["single", "double"],
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: false,
    hasLamination: true,
    hasUVVarnish: true,
    hasSides: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/covers",
      jobsPath: "/batches/covers/jobs",
      newJobPath: "/batches/covers/jobs/new",
      batchesPath: "/batches/covers/batches",
      basePath: "/batches/covers",
      jobDetailPath: (id) => `/batches/covers/jobs/${id}`,
      jobEditPath: (id) => `/batches/covers/jobs/${id}/edit`,
    },
    ui: {
      icon: "book",
      color: "indigo",
      jobFormTitle: "Cover Job",
      title: "Covers",
      batchFormTitle: "Cover Batch"
    }
  },
  "Boxes": {
    productType: "Boxes",
    tableName: "box_jobs",
    jobNumberPrefix: "PB",
    availablePaperTypes: ["Premium", "Standard"],
    hasPaperType: true,
    slaTargetDays: 5,
    routes: {
      indexPath: "/batches/boxes",
      jobsPath: "/batches/boxes/jobs",
      newJobPath: "/batches/boxes/jobs/new",
      batchesPath: "/batches/boxes/batches",
      basePath: "/batches/boxes",
      jobDetailPath: (id) => `/batches/boxes/jobs/${id}`,
      jobEditPath: (id) => `/batches/boxes/jobs/${id}/edit`,
    },
    ui: {
      icon: "package",
      color: "slate",
      jobFormTitle: "Box Job",
      title: "Boxes",
      batchFormTitle: "Box Batch"
    }
  },
};
