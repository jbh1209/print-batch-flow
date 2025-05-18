
import { ProductConfig } from '../types/productConfigTypes';

export const postcardsConfig: ProductConfig = {
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
};
