
import { ExistingTableName, LaminationType as BaseLaminationType } from './baseTypes';

// Use a specific name for re-export to avoid ambiguity
export type LaminationType = BaseLaminationType;

export interface ProductConfig {
  productType: string;
  tableName: ExistingTableName;
  jobNumberPrefix: string;
  availablePaperTypes?: string[];
  availablePaperWeights?: string[];
  availableSizes?: string[];
  availableLaminationTypes?: LaminationType[];
  availableSidesTypes?: string[]; // Add this property
  availableUVVarnishTypes?: string[]; // Add this property
  hasLamination?: boolean;
  hasPaperType?: boolean;
  hasPaperWeight?: boolean;
  hasSize?: boolean;
  hasSides?: boolean; // Add this property
  hasUVVarnish?: boolean; // Add this property
  slaTargetDays: number;
  routes: {
    indexPath: string;
    jobsPath: string;
    newJobPath: string;
    batchesPath: string;
    basePath: string;
    jobDetailPath: (id: string) => string;
    jobEditPath: (id: string) => string;
  };
  ui: {
    icon: string;
    color: string;
    jobFormTitle: string;
    title: string;
    batchFormTitle: string;
  };
}
