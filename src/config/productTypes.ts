
export type LaminationType = 'none' | 'matt' | 'gloss' | 'soft_touch' | 'front_gloss_lam' | 'front_matt_lam' | 'no_lam';
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
  double_sided?: boolean;
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
      indexPath: "/batchflow/batches/business-cards",
      jobsPath: "/batchflow/batches/business-cards/jobs",
      newJobPath: "/batchflow/batches/business-cards/jobs/new",
      batchesPath: "/batchflow/batches/business-cards/batches",
      basePath: "/batchflow/batches/business-cards",
      jobDetailPath: (id) => `/batchflow/batches/business-cards/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/business-cards/jobs/edit/${id}`,
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
    availablePaperTypes: ["Matt", "Gloss"],
    availablePaperWeights: ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm"],
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batchflow/batches/flyers",
      jobsPath: "/batchflow/batches/flyers/jobs",
      newJobPath: "/batchflow/batches/flyers/jobs/new",
      batchesPath: "/batchflow/batches/flyers/batches",
      basePath: "/batchflow/batches/flyers",
      jobDetailPath: (id) => `/batchflow/batches/flyers/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/flyers/jobs/edit/${id}`,
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
    availableSidesTypes: ["single", "double"],
    availableLaminationTypes: ["front_gloss_lam", "front_matt_lam", "no_lam"],
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSides: true,
    hasLamination: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batchflow/batches/postcards",
      jobsPath: "/batchflow/batches/postcards/jobs",
      newJobPath: "/batchflow/batches/postcards/jobs/new",
      batchesPath: "/batchflow/batches/postcards/batches",
      basePath: "/batchflow/batches/postcards",
      jobDetailPath: (id) => `/batchflow/batches/postcards/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/postcards/jobs/edit/${id}`,
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
      indexPath: "/batchflow/batches/sleeves",
      jobsPath: "/batchflow/batches/sleeves/jobs",
      newJobPath: "/batchflow/batches/sleeves/jobs/new",
      batchesPath: "/batchflow/batches/sleeves/batches",
      basePath: "/batchflow/batches/sleeves",
      jobDetailPath: (id) => `/batchflow/batches/sleeves/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/sleeves/jobs/edit/${id}`,
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
      indexPath: "/batchflow/batches/stickers",
      jobsPath: "/batchflow/batches/stickers/jobs",
      newJobPath: "/batchflow/batches/stickers/jobs/new",
      batchesPath: "/batchflow/batches/stickers/batches",
      basePath: "/batchflow/batches/stickers",
      jobDetailPath: (id) => `/batchflow/batches/stickers/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/stickers/jobs/edit/${id}`,
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
    availablePaperWeights: ["80gsm bond", "115gsm", "130gsm", "170gsm", "200gsm", "250gsm", "300gsm", "350gsm"],
    availableSidesTypes: ["single", "double"],
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    hasSides: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batchflow/batches/posters",
      jobsPath: "/batchflow/batches/posters/jobs",
      newJobPath: "/batchflow/batches/posters/jobs/new",
      batchesPath: "/batchflow/batches/posters/batches",
      basePath: "/batchflow/batches/posters",
      jobDetailPath: (id) => `/batchflow/batches/posters/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/posters/jobs/edit/${id}`,
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
    hasSize: false,
    hasPaperType: true,
    hasPaperWeight: true,
    hasLamination: true,
    hasUVVarnish: true,
    hasSides: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/batchflow/batches/covers",
      jobsPath: "/batchflow/batches/covers/jobs",
      newJobPath: "/batchflow/batches/covers/jobs/new",
      batchesPath: "/batchflow/batches/covers/batches",
      basePath: "/batchflow/batches/covers",
      jobDetailPath: (id) => `/batchflow/batches/covers/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/covers/jobs/edit/${id}`,
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
    availablePaperTypes: ["FBB 230gsm", "FBB 300gsm", "300gsm matt"],
    availableLaminationTypes: ["soft_touch", "matt", "gloss"],
    hasPaperType: true,
    hasLamination: true,
    slaTargetDays: 5,
    routes: {
      indexPath: "/batchflow/batches/boxes",
      jobsPath: "/batchflow/batches/boxes/jobs",
      newJobPath: "/batchflow/batches/boxes/jobs/new",
      batchesPath: "/batchflow/batches/boxes/batches",
      basePath: "/batchflow/batches/boxes",
      jobDetailPath: (id) => `/batchflow/batches/boxes/jobs/${id}`,
      jobEditPath: (id) => `/batchflow/batches/boxes/jobs/edit/${id}`,
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
