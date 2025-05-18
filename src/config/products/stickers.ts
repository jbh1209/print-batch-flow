
import { ProductConfig } from '../types/baseTypes';

export const stickersConfig: ProductConfig = {
  productType: "Stickers",
  tableName: "sticker_jobs",
  jobNumberPrefix: "STK",
  availablePaperTypes: ["Paper", "Vinyl"],
  availableLaminationTypes: ["none", "matt", "gloss"],
  availablePrinterTypes: ["HP 12000", "Indigo 7000"],
  availableSheetSizes: ["530x750mm", "364x515mm"],
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
