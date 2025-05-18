
import { ProductConfig } from "../types/baseTypes";

export const postersConfig: ProductConfig = {
  productType: "Posters",
  tableName: "poster_jobs",
  jobNumberPrefix: "POS",
  availablePaperTypes: ["Matt", "Gloss"],
  availablePaperWeights: ["130gsm", "170gsm", "250gsm"],
  availableSizes: ["A3", "A2", "A1", "A0"],
  availableLaminationTypes: ["none", "gloss", "matt"],
  availableSidesTypes: ["single", "double"],
  availablePrinterTypes: ["HP 12000", "Indigo 7000"],
  availableSheetSizes: ["530x750mm", "364x515mm"],
  hasLamination: true,
  hasPaperType: true,
  hasPaperWeight: true,
  hasSize: true,
  hasSides: true,
  slaTargetDays: 3,
  routes: {
    indexPath: "/posters",
    jobsPath: "/posters/jobs",
    newJobPath: "/posters/jobs/new",
    batchesPath: "/batches/posters/batches",
    basePath: "/posters",
    jobDetailPath: (id: string) => `/posters/jobs/${id}`,
    jobEditPath: (id: string) => `/posters/jobs/${id}/edit`,
  },
  ui: {
    icon: "image-square",
    color: "pink",
    jobFormTitle: "Poster Job",
    title: "Posters",
    batchFormTitle: "Poster Batch"
  },
};
