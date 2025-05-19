
import { ProductConfig } from "../types/productConfigTypes";

export const coversConfig: ProductConfig = {
  productType: "Covers",
  tableName: "cover_jobs",
  jobNumberPrefix: "COV",
  availablePaperTypes: ["Matt", "Gloss", "Premium"],
  availablePaperWeights: ["250gsm", "350gsm", "400gsm"],
  availableLaminationTypes: ["none", "gloss", "matte", "soft_touch"],
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
    indexPath: "/covers",
    jobsPath: "/covers/jobs",
    newJobPath: "/covers/jobs/new",
    batchesPath: "/batches/covers/batches",
    basePath: "/covers",
    jobDetailPath: (id: string) => `/covers/jobs/${id}`,
    jobEditPath: (id: string) => `/covers/jobs/${id}/edit`,
  },
  ui: {
    icon: "book-open",
    color: "blue",
    jobFormTitle: "Cover Job",
    title: "Covers",
    batchFormTitle: "Cover Batch"
  }
};
