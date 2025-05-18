
import { ProductConfig } from '../types/productConfigTypes';

export const boxesConfig: ProductConfig = {
  productType: "Boxes",
  tableName: "box_jobs",
  jobNumberPrefix: "PB",
  availablePaperTypes: ["Premium", "Standard"],
  hasPaperType: true,
  slaTargetDays: 5,
  routes: {
    indexPath: "/batches/boxes",
    jobsPath: "/batches/boxes/jobs",
    newJobPath: "/batches/boxes/jobs/new",
    batchesPath: "/batches/boxes/batches",
    basePath: "/batches/boxes",
    jobDetailPath: (id) => `/batches/boxes/jobs/${id}`,
    jobEditPath: (id) => `/batches/boxes/jobs/${id}/edit`,
  },
  ui: {
    icon: "package",
    color: "slate",
    jobFormTitle: "Box Job",
    title: "Boxes",
    batchFormTitle: "Box Batch"
  }
};
