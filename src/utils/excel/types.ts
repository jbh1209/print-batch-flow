import { EnhancedStage } from './enhancedStageMapper';

export interface ParsedJob {
  woNo: string;
  customer: string;
  status: string;
  date: string;
  rep: string;
  category: string;
  reference: string;
  qty: number;
  woQty: number;
  dueDate: string;
  location: string;
  estimatedHours: number;
  setupTime: number;
  runningSpeed: number;
  speedUnit: string;
  specifications: string;
  paperWeight: number;
  paperType: string;
  lamination: string;
  [key: string]: string | number | undefined;
}

export interface RowMappingResult {
  success: boolean;
  message: string;
  data?: any;
  excelRowIndex?: number;
  mappedStageId?: string;
  mappedStageName?: string;
  mappedStageSpecId?: string;
  mappedStageSpecName?: string;
  paperSpecification?: string;
  partType?: string;
  qty?: number;
  woQty?: number;
  isUnmapped?: boolean;
  manualOverride?: boolean;
  ignored?: boolean;
  groupName?: string;
  customRowId?: string;
  instanceId?: string;
  isCustomRow?: boolean;
  description?: string;
  category?: string;
  confidence?: number;
  excelData?: any;
}

export interface ImportStats {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  invalidWONumbers: number;
  invalidDates: number;
  invalidTimingData: number;
}

export interface MatrixExcelData {
  headers: string[];
  data: any[][];
  totalRows: number;
  detectedGroups: string[];
  groupColumn: number;
  descriptionColumn: number;
  qtyColumn: number;
  woQtyColumn: number;
  rows: any[][];
}

export interface CoverTextDetection {
  isBookJob: boolean;
  components: { type: string; printing: string }[];
  dependencyGroupId?: string;
}

export interface JobValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: ParsedJob;
}

export interface JobUploadResult {
  success: boolean;
  message: string;
  jobId?: string;
  errors?: string[];
}

export interface ExcelPreviewData {
  headers: string[];
  sampleRows: any[][];
  totalRows: number;
}

export interface ColumnMapping {
  [key: string]: number;
  woNo: number;
  status: number;
  date: number;
  rep: number;
  category: number;
  customer: number;
  reference: number;
  qty: number;
  woQty: number; // New field for work order quantity
  dueDate: number;
  location: number;
  estimatedHours: number;
  setupTime: number;
  runningSpeed: number;
  speedUnit: number;
  specifications: number;
  paperWeight: number;
  paperType: number;
  lamination: number;
}

export interface EnhancedParsedJob extends ParsedJob {
  enhancedStages: EnhancedStage[];
}

export interface DeliverySpecification {
  id: string;
  name: string;
  description?: string;
  method?: string;
  confidence?: number;
}

export interface GroupSpecifications {
  [key: string]: any;
}
