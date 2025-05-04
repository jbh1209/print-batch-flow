export type LaminationType = 'none' | 'matt' | 'gloss' | 'soft_touch';

export interface BaseJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  due_date: string;
  status: string;
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
}

export interface ProductConfig {
  productType: string;
  tableName: string;
  jobNumberPrefix?: string;
  availablePaperTypes?: string[];
  availableLaminationTypes?: LaminationType[];
  availablePaperWeights?: string[];
  availableSizes?: string[];
  slaTargetDays: number;
  routes: {
    indexPath: string;
    jobsPath: string;
    newJobPath: string;
    batchesPath: string;
  };
  ui: {
    icon: string;
    color: string;
    jobFormTitle: string;
  };
}

export const productConfigs: Record<string, ProductConfig> = {
  "BusinessCards": {
    productType: "BusinessCards",
    tableName: "business_card_jobs",
    jobNumberPrefix: "BC",
    availablePaperTypes: ["350gsm Matt", "350gsm Silk", "400gsm Matt", "400gsm Silk"],
    availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"],
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/business-cards",
      jobsPath: "/batches/business-cards/jobs",
      newJobPath: "/batches/business-cards/jobs/new",
      batchesPath: "/batches/business-cards/batches",
    },
    ui: {
      icon: "card",
      color: "blue",
      jobFormTitle: "Business Card Job",
    }
  },
  "Flyers": {
    productType: "Flyers",
    tableName: "flyer_jobs",
    jobNumberPrefix: "FL",
    availableSizes: ["A6", "A5", "A4", "DL"],
    availablePaperTypes: ["Gloss", "Silk", "Uncoated"],
    availablePaperWeights: ["115gsm", "130gsm", "170gsm", "250gsm", "300gsm", "350gsm"],
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/flyers",
      jobsPath: "/batches/flyers/jobs",
      newJobPath: "/batches/flyers/jobs/new",
      batchesPath: "/batches/flyers/batches",
    },
    ui: {
      icon: "package",
      color: "orange",
      jobFormTitle: "Flyer Job",
    }
  },
   "Postcards": {
    productType: "Postcards",
    tableName: "postcard_jobs",
    jobNumberPrefix: "PC",
    availableSizes: ["A6", "A5", "A4", "DL"],
    availablePaperTypes: ["Gloss", "Silk", "Uncoated"],
    availablePaperWeights: ["115gsm", "130gsm", "170gsm", "250gsm", "300gsm", "350gsm"],
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/postcards",
      jobsPath: "/batches/postcards/jobs",
      newJobPath: "/batches/postcards/jobs/new",
      batchesPath: "/batches/postcards/batches",
    },
    ui: {
      icon: "mail",
      color: "amber",
      jobFormTitle: "Postcard Job",
    }
  },
  "Sleeves": {
    productType: "Sleeves",
    tableName: "sleeve_jobs",
    jobNumberPrefix: "SL",
    availablePaperTypes: ["Kraft", "White"],
    slaTargetDays: 5,
    routes: {
      indexPath: "/batches/sleeves",
      jobsPath: "/batches/sleeves/jobs",
      newJobPath: "/batches/sleeves/jobs/new",
      batchesPath: "/batches/sleeves/batches",
    },
    ui: {
      icon: "box",
      color: "violet",
      jobFormTitle: "Sleeve Job",
    }
  },
  "Stickers": {
    productType: "Stickers",
    tableName: "sticker_jobs",
    jobNumberPrefix: "STK",
    availablePaperTypes: ["Matt White Vinyl", "Gloss White Vinyl", "Clear Vinyl", "Matt Polyester", "Gloss Polyester"],
    availableLaminationTypes: ["none", "matt", "gloss"],
    slaTargetDays: 3,
    routes: {
      indexPath: "/batches/stickers",
      jobsPath: "/batches/stickers/jobs",
      newJobPath: "/batches/stickers/jobs/new",
      batchesPath: "/batches/stickers/batches",
    },
    ui: {
      icon: "sticker",
      color: "emerald",
      jobFormTitle: "Sticker Job",
    }
  },
};
