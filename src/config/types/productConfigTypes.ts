
import { ExistingTableName } from './baseTypes';

export type LaminationType = 'none' | 'gloss' | 'matt' | 'soft_touch';

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
