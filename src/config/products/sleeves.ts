
import { ProductConfig } from '../types/baseTypes';

export const sleevesConfig: ProductConfig = {
  productType: "Sleeves",
  tableName: "sleeve_jobs",
  jobNumberPrefix: "SL",
  availablePaperTypes: ["Kraft", "White"],
  availablePrinterTypes: ["HP 12000", "Indigo 7000"],
  availableSheetSizes: ["530x750mm", "364x515mm"],
  hasPaperType: true,
  slaTargetDays: 5,
  routes: {
    indexPath: "/batches/sleeves",
    jobsPath: "/batches/sleeves/jobs",
    newJobPath: "/batches/sleeves/jobs/new",
    batchesPath: "/batches/sleeves/batches",
    basePath: "/batches/sleeves",
    jobDetailPath: (id) => `/batches/sleeves/jobs/${id}`,
    jobEditPath: (id) => `/batches/sleeves/jobs/${id}/edit`,
  },
  ui: {
    icon: "box",
    color: "violet",
    jobFormTitle: "Sleeve Job",
    title: "Sleeves",
    batchFormTitle: "Sleeve Batch"
  }
};
