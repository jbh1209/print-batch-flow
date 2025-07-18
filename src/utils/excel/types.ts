
export interface ParsedJob {
  wo_no: string;
  status: string;
  date: string | null;
  rep: string;
  category: string;
  customer: string;
  reference: string;
  qty: number;
  due_date: string | null;
  location: string;
  // Basic specification fields
  estimated_hours?: number | null;
  setup_time_minutes?: number | null;
  running_speed?: number | null;
  speed_unit?: string | null;
  specifications?: string | null;
  paper_weight?: string | null;
  paper_type?: string | null;
  lamination?: string | null;
  // New matrix-based fields
  size?: string | null;
  specification?: string | null;
  contact?: string | null;
  // Group-based specifications
  paper_specifications?: GroupSpecifications | null;
  delivery_specifications?: GroupSpecifications | null;
  finishing_specifications?: GroupSpecifications | null;
  prepress_specifications?: GroupSpecifications | null;
  printing_specifications?: GroupSpecifications | null;
  packaging_specifications?: GroupSpecifications | null;
  operation_quantities?: OperationQuantities | null;
  // Cover/text workflow detection
  cover_text_detection?: CoverTextDetection | null;
  // Excel row tracking for accurate row mapping
  _originalExcelRow?: any[];
  _originalRowIndex?: number;
}

export interface GroupSpecifications {
  [key: string]: {
    description?: string;
    qty?: number;
    wo_qty?: number;
    specifications?: string;
    [key: string]: any;
  };
}

export interface OperationQuantities {
  [operation: string]: {
    operation_qty: number;
    total_wo_qty: number;
  };
}

export interface MatrixExcelData {
  headers: string[];
  rows: any[][];
  groupColumn?: number;
  workOrderColumn?: number;
  descriptionColumn?: number;
  qtyColumn?: number;
  woQtyColumn?: number;
  detectedGroups: string[];
}

export interface ImportStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  invalidWONumbers: number;
  invalidDates: number;
  invalidTimingData: number;
  invalidSpecifications: number;
}

export interface ParsedData {
  jobs: ParsedJob[];
  stats: ImportStats;
}

export interface DeliverySpecification {
  method: 'delivery' | 'collection';
  address?: string;
  contact?: string;
  notes?: string;
  confidence: number;
}

export interface CoverTextComponent {
  type: 'cover' | 'text';
  printing: {
    description: string;
    qty: number;
    wo_qty: number;
    row: any[];
  };
  paper?: {
    description: string;
    qty: number;
    wo_qty: number;
    row: any[];
  };
}

export interface CoverTextDetection {
  isBookJob: boolean;
  components: CoverTextComponent[];
  dependencyGroupId?: string;
}

export interface RowMappingResult {
  excelRowIndex: number;
  excelData: any[];
  groupName: string;
  description: string;
  qty: number;
  woQty: number;
  mappedStageId: string | null;
  mappedStageName: string | null;
  mappedStageSpecId: string | null;
  mappedStageSpecName: string | null;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper' | 'unknown';
  manualOverride?: boolean;
  isUnmapped: boolean;
  instanceId?: string;
  paperSpecification?: string;
  partType?: string;
  // Enhanced row management
  ignored?: boolean;
  isCustomRow?: boolean;
  customRowId?: string;
}

export interface StageMapping {
  stageId: string;
  stageName: string;
  stageSpecId?: string;
  stageSpecName?: string;
  confidence: number;
  specifications: string[];
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging';
  instanceId?: string;
  quantity?: number;
  paperSpecification?: string;
  groupName?: string;
  requiresCustomWorkflow?: boolean;
}

export interface EnhancedMappingResult {
  processedJobs: ParsedJob[];
  stageMappingResult?: {
    mappedRows: RowMappingResult[];
    unmappedRows: RowMappingResult[];
    stats: {
      total: number;
      mapped: number;
      unmapped: number;
      highConfidence: number;
      lowConfidence: number;
    };
  };
  paperMappings?: any[];
  deliveryMappings?: any[];
  enhancedDeliveryMappings?: any[];
}

export interface EnhancedJobCreationResult {
  preparedJobs?: any[];
  savedJobs?: any[];
  createdJobs?: any[];
  failedJobs?: any[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    errors: string[];
    workflowsInitialized?: number;
    newCategories?: number;
  };
  generateQRCodes?: boolean;
  headers?: string[];
  excelRows?: any[][];
  userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>;
  stageMappingResult?: {
    mappedRows: RowMappingResult[];
    unmappedRows: RowMappingResult[];
    stats: {
      total: number;
      mapped: number;
      unmapped: number;
      highConfidence: number;
      lowConfidence: number;
    };
  };
  rowMappings?: { [woNo: string]: RowMappingResult[] };
  categoryAssignments?: any[];
}
