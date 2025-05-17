
import { ProductConfig } from '../types/productConfigTypes';

export const sleevesConfig: ProductConfig = {
  productType: "Sleeves",
  tableName: "sleeve_jobs",
  jobNumberPrefix: "SL",
  availablePaperTypes: ["Kraft", "White"],
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
