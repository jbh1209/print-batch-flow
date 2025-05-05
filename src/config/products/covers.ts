
import { ProductConfig } from '../types/productConfigTypes';

export const coversConfig: ProductConfig = {
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
};
