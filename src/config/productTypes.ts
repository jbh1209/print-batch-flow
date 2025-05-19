import { ExistingTableName, BaseBatch, BaseJob, BatchStatus } from './types/baseTypes';

export type TableName = ExistingTableName;

export type ProductType =
  | 'flyers'
  | 'postcards'
  | 'business-cards'
  | 'posters'
  | 'sleeves'
  | 'boxes'
  | 'covers'
  | 'stickers'
  | 'product-pages';

export type LaminationType =
  | 'gloss'
  | 'matte'
  | 'soft-touch'
  | 'none';

export interface ProductConfig {
  productType: ProductType;
  tableName: ExistingTableName;
  ui: {
    title: string;
    createTitle?: string;
    editTitle?: string;
  };
  routes: {
    basePath: string;
    newJobPath: string;
    jobDetailPath: (id: string) => string;
    jobEditPath: (id: string) => string;
  };
  hasSize: boolean;
  hasPaperType: boolean;
  slaTargetDays: number;
}

export type { ExistingTableName, BaseBatch, BaseJob, BatchStatus } from './types/baseTypes';
