
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
      indexPath: "/printstream/batches/business-cards",
      jobsPath: "/printstream/batches/business-cards/jobs",
      newJobPath: "/printstream/batches/business-cards/jobs/new",
      batchesPath: "/printstream/batches/business-cards/batches",
      basePath: "/printstream/batches/business-cards",
      jobDetailPath: (id) => `/printstream/batches/business-cards/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/business-cards/jobs/edit/${id}`,
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
    availablePaperWeights: ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm", "300gsm", "350gsm"],
    hasSize: true,
    hasPaperType: true,
    hasPaperWeight: true,
    slaTargetDays: 3,
    routes: {
      indexPath: "/printstream/batches/flyers",
      jobsPath: "/printstream/batches/flyers/jobs",
      newJobPath: "/printstream/batches/flyers/jobs/new",
      batchesPath: "/printstream/batches/flyers/batches",
      basePath: "/printstream/batches/flyers",
      jobDetailPath: (id) => `/printstream/batches/flyers/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/flyers/jobs/edit/${id}`,
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
      indexPath: "/printstream/batches/postcards",
      jobsPath: "/printstream/batches/postcards/jobs",
      newJobPath: "/printstream/batches/postcards/jobs/new",
      batchesPath: "/printstream/batches/postcards/batches",
      basePath: "/printstream/batches/postcards",
      jobDetailPath: (id) => `/printstream/batches/postcards/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/postcards/jobs/edit/${id}`,
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
      indexPath: "/printstream/batches/sleeves",
      jobsPath: "/printstream/batches/sleeves/jobs",
      newJobPath: "/printstream/batches/sleeves/jobs/new",
      batchesPath: "/printstream/batches/sleeves/batches",
      basePath: "/printstream/batches/sleeves",
      jobDetailPath: (id) => `/printstream/batches/sleeves/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/sleeves/jobs/edit/${id}`,
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
      indexPath: "/printstream/batches/stickers",
      jobsPath: "/printstream/batches/stickers/jobs",
      newJobPath: "/printstream/batches/stickers/jobs/new",
      batchesPath: "/printstream/batches/stickers/batches",
      basePath: "/printstream/batches/stickers",
      jobDetailPath: (id) => `/printstream/batches/stickers/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/stickers/jobs/edit/${id}`,
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
      indexPath: "/printstream/batches/posters",
      jobsPath: "/printstream/batches/posters/jobs",
      newJobPath: "/printstream/batches/posters/jobs/new",
      batchesPath: "/printstream/batches/posters/batches",
      basePath: "/printstream/batches/posters",
      jobDetailPath: (id) => `/printstream/batches/posters/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/posters/jobs/edit/${id}`,
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
      indexPath: "/printstream/batches/covers",
      jobsPath: "/printstream/batches/covers/jobs",
      newJobPath: "/printstream/batches/covers/jobs/new",
      batchesPath: "/printstream/batches/covers/batches",
      basePath: "/printstream/batches/covers",
      jobDetailPath: (id) => `/printstream/batches/covers/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/covers/jobs/edit/${id}`,
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
      indexPath: "/printstream/batches/boxes",
      jobsPath: "/printstream/batches/boxes/jobs",
      newJobPath: "/printstream/batches/boxes/jobs/new",
      batchesPath: "/printstream/batches/boxes/batches",
      basePath: "/printstream/batches/boxes",
      jobDetailPath: (id) => `/printstream/batches/boxes/jobs/${id}`,
      jobEditPath: (id) => `/printstream/batches/boxes/jobs/edit/${id}`,
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
