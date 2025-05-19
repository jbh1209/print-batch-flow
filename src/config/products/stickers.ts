
import { ProductConfig } from '../types/productConfigTypes';

export const stickersConfig: ProductConfig = {
  productType: "Stickers",
  tableName: "sticker_jobs",
  jobNumberPrefix: "STK",
  availablePaperTypes: ["Paper", "Vinyl"],
  availableLaminationTypes: ["none", "matte", "gloss"],
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
};
