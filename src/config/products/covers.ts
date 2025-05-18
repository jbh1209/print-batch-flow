
import { ProductConfig } from "../types/baseTypes";

export const coversConfig: ProductConfig = {
  productType: "Covers",
  tableName: "cover_jobs",
  jobNumberPrefix: "COV",
  availablePaperTypes: ["Matt", "Gloss", "Premium"],
  availablePaperWeights: ["250gsm", "350gsm", "400gsm"],
  availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"],
  availablePrinterTypes: ["HP 12000", "Indigo 7000"],
  availableSheetSizes: ["530x750mm", "364x515mm"],
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
