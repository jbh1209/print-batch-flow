
import { LaminationType, TableName, UVVarnishType } from './baseTypes';

// Product configuration interface
export interface ProductConfig {
  productType: string;
  tableName: TableName;
  jobNumberPrefix?: string;
  availablePaperTypes?: string[];
  availableLaminationTypes?: LaminationType[];
  availablePaperWeights?: string[];
  availableSizes?: string[];
  availableSidesTypes?: string[];
  availableUVVarnishTypes?: UVVarnishType[];
  hasSize?: boolean;
  hasPaperType?: boolean;
  hasPaperWeight?: boolean;
  hasLamination?: boolean;
  hasSides?: boolean;
  hasUVVarnish?: boolean;
  slaTargetDays: number;
  routes: {
    indexPath: string;
    jobsPath: string;
    newJobPath: string;
    batchesPath: string;
    basePath?: string;
    jobDetailPath?: (id: string) => string;
    jobEditPath?: (id: string) => string;
  };
  ui: {
    icon: string;
    color: string;
    jobFormTitle: string;
    title?: string;
    batchFormTitle?: string;
  };
}
