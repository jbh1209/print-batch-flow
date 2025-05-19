
import { ExistingTableName } from './baseTypes';

export type LaminationType = 'none' | 'gloss' | 'matte' | 'soft_touch';

export interface ProductConfig {
  productType: string;
  tableName: ExistingTableName;
  jobNumberPrefix: string;
  availablePaperTypes?: string[];
  availablePaperWeights?: string[];
  availableSizes?: string[];
  availableLaminationTypes?: LaminationType[];
  availableSidesTypes?: string[]; 
  availableUVVarnishTypes?: string[]; 
  hasLamination?: boolean;
  hasPaperType?: boolean;
  hasPaperWeight?: boolean;
  hasSize?: boolean;
  hasSides?: boolean;
  hasUVVarnish?: boolean;
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
    createTitle?: string;
    editTitle?: string;
    batchFormTitle: string;
  };
}
