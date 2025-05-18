
import { ProductConfig } from '../types/baseTypes';

export const flyersConfig: ProductConfig = {
  productType: "Flyers",
  tableName: "flyer_jobs",
  jobNumberPrefix: "FL",
  availableSizes: ["A6", "A5", "A4", "DL"],
  availablePaperTypes: ["Gloss", "Silk", "Uncoated"],
  availablePaperWeights: ["115gsm", "130gsm", "170gsm", "250gsm", "300gsm", "350gsm"],
  availablePrinterTypes: ["HP 12000", "Indigo 7000"],
  availableSheetSizes: ["530x750mm", "364x515mm"],
  hasSize: true,
  hasPaperType: true,
  hasPaperWeight: true,
  slaTargetDays: 3,
  routes: {
    indexPath: "/batches/flyers",
    jobsPath: "/batches/flyers/jobs",
    newJobPath: "/batches/flyers/jobs/new",
    batchesPath: "/batches/flyers/batches",
    basePath: "/batches/flyers",
    jobDetailPath: (id) => `/batches/flyers/jobs/${id}`,
    jobEditPath: (id) => `/batches/flyers/jobs/${id}/edit`,
  },
  ui: {
    icon: "package",
    color: "orange",
    jobFormTitle: "Flyer Job",
    title: "Flyers",
    batchFormTitle: "Flyer Batch"
  }
};
