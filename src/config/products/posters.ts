
import { ProductConfig } from "../types/productConfigTypes";

export const postersConfig: ProductConfig = {
  productType: "Posters",
  tableName: "poster_jobs",
  jobNumberPrefix: "POS",
  availablePaperTypes: ["Matt", "Gloss"],
  availablePaperWeights: ["130gsm", "170gsm", "250gsm"],
  availableSizes: ["A3", "A2", "A1", "A0"],
  availableLaminationTypes: ["none", "gloss", "matt"],
  availableSidesTypes: ["single", "double"],
  hasLamination: true,
  hasPaperType: true,
  hasPaperWeight: true,
  hasSize: true,
  hasSides: true,
  slaTargetDays: 3,
  routes: {
    indexPath: "/batches/posters",
    jobsPath: "/batches/posters/jobs",
    newJobPath: "/batches/posters/jobs/new",
    batchesPath: "/batches/posters/batches",
    basePath: "/batches/posters",
    jobDetailPath: (id: string) => `/batches/posters/jobs/${id}`,
    jobEditPath: (id: string) => `/batches/posters/jobs/${id}/edit`,
  },
  ui: {
    icon: "image-square",
    color: "pink",
    jobFormTitle: "Poster Job",
    title: "Posters",
    batchFormTitle: "Poster Batch"
  },
};
