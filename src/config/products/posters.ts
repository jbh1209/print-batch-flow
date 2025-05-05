
import { ProductConfig } from '../types/productConfigTypes';

export const postersConfig: ProductConfig = {
  productType: "Posters",
  tableName: "poster_jobs",
  jobNumberPrefix: "POST",
  availableSizes: ["A4", "A3"],
  availablePaperTypes: ["Matt", "Gloss"],
  availablePaperWeights: ["130gsm", "150gsm", "170gsm", "200gsm", "250gsm", "300gsm"],
  availableSidesTypes: ["single", "double"],
  hasSize: true,
  hasPaperType: true,
  hasPaperWeight: true,
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
};
