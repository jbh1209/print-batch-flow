
import { ProductConfig } from "../types/productConfigTypes";

export const coversConfig: ProductConfig = {
  productType: "Covers",
  tableName: "cover_jobs",
  jobNumberPrefix: "COV",
  availablePaperTypes: ["Matt", "Gloss", "Premium"],
  availablePaperWeights: ["250gsm", "350gsm", "400gsm"],
  availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"],
  hasLamination: true,
  hasPaperType: true,
  hasPaperWeight: true,
  hasSize: false,
  hasSides: true,
  hasUVVarnish: true,
  availableSidesTypes: ["single", "double"],
  availableUVVarnishTypes: ["none", "spot", "full"],
  slaTargetDays: 5,
  routes: {
    indexPath: "/batches/covers",
    jobsPath: "/batches/covers/jobs",
    newJobPath: "/batches/covers/jobs/new",
    batchesPath: "/batches/covers/batches",
    basePath: "/batches/covers",
    jobDetailPath: (id: string) => `/batches/covers/jobs/${id}`,
    jobEditPath: (id: string) => `/batches/covers/jobs/${id}/edit`,
  },
  ui: {
    icon: "book-open",
    color: "blue",
    jobFormTitle: "Cover Job",
    title: "Covers",
    batchFormTitle: "Cover Batch"
  }
};
