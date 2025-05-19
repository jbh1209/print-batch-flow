
import { ProductConfig } from '../types/productConfigTypes';

export const businessCardsConfig: ProductConfig = {
  productType: "BusinessCards",
  tableName: "business_card_jobs",
  jobNumberPrefix: "BC",
  availablePaperTypes: ["350gsm Matt", "350gsm Silk", "400gsm Matt", "400gsm Silk"],
  availableLaminationTypes: ["none", "gloss", "matt", "soft_touch"], // Using "matt" to match database
  hasPaperType: true,
  hasLamination: true,
  slaTargetDays: 3,
  routes: {
    indexPath: "/batches/business-cards",
    jobsPath: "/batches/business-cards/jobs",
    newJobPath: "/batches/business-cards/jobs/new",
    batchesPath: "/batches/business-cards/batches",
    basePath: "/batches/business-cards",
    jobDetailPath: (id) => `/batches/business-cards/jobs/${id}`,
    jobEditPath: (id) => `/batches/business-cards/jobs/${id}/edit`,
  },
  ui: {
    icon: "card",
    color: "blue",
    jobFormTitle: "Business Card Job",
    title: "Business Cards",
    batchFormTitle: "Business Card Batch"
  }
};
