
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
  size?: string | null;
  specification?: string | null;
  contact?: string | null;
  estimated_hours?: number | null;
  setup_time_minutes?: number | null;
  running_speed?: number | null;
  speed_unit?: string | null;
  specifications?: string | null;
  paper_weight?: string | null;
  paper_type?: string | null;
  lamination?: string | null;
  paper_specifications?: GroupSpecifications | null;
  delivery_specifications?: GroupSpecifications | null;
  finishing_specifications?: GroupSpecifications | null;
  prepress_specifications?: GroupSpecifications | null;
  printing_specifications?: GroupSpecifications | null;
  packaging_specifications?: GroupSpecifications | null;
  operation_quantities?: OperationQuantities | null;
  cover_text_detection?: CoverTextDetection | null;
  _originalExcelRow?: any[];
  _originalRowIndex?: number;
}

export interface CoverTextDetection {
  isBookJob: boolean;
  components: CoverTextComponent[];
  dependencyGroupId?: string;
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

export interface GroupSpecifications {
  [key: string]: {
    description: string;
    qty: number;
    wo_qty: number;
    specifications: string;
    mappedStageId?: string;
    mappedStageName?: string;
    originalColumnIndex?: unknown;
    confidence?: number;
    type?: string;
    weight?: string;
    method?: string;
    specification_id?: string;
    specification_name?: string;
    address?: string;
    original_text?: string;
    route?: string;
    date?: string;
    special_instructions?: string;
    color?: string;
    size?: string;
    finish?: string;
    contact?: string;
    detected_features?: any;
    notes?: string;
  };
}

export interface OperationQuantities {
  [key: string]: {
    operation_qty: number;
    total_wo_qty: number;
  };
}

export interface MatrixExcelData {
  headers: string[];
  rows: any[][];
  groupColumn: number;
  workOrderColumn: number;
  descriptionColumn: number;
  qtyColumn: number;
  woQtyColumn: number;
  detectedGroups: string[];
}

export interface ParsedData {
  jobs: ParsedJob[];
  stats: ImportStats;
}

export interface ImportStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  invalidWONumbers: number;
  invalidDates: number;
  invalidTimingData: number;
  invalidSpecifications?: number;
}

export interface RowMappingResult {
  groupName: string;
  description: string;
  qty: number;
  woQty: number;
  mappedStageId: string;
  mappedStageName: string;
  mappedStageSpecId?: string | null;
  mappedStageSpecName?: string | null;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper';
  isUnmapped: boolean;
  excelRowIndex: number;
  excelData: any[];
  manualOverride?: boolean;
  ignored?: boolean;
  paperSpecification?: string;
  partType?: string;
  customRowId?: string;
  instanceId?: string;
  isCustomRow?: boolean;
}

export interface DeliverySpecification {
  description: string;
  qty: number;
  wo_qty: number;
  specifications: string;
  method?: string;
  confidence?: number;
  type?: string;
  weight?: string;
  specification_id?: string;
}

export interface StageMapping {
  stageId: string;
  stageName: string;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper';
  specifications?: string;
}

export interface EnhancedJobCreationResult {
  success: boolean;
  createdJobIds: string[];
  createdJobs?: any[];
  failedJobs?: any[];
  errors?: string[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    workflowsInitialized?: number;
    newCategories?: number;
  };
  rowMappings?: RowMappingResult[];
  categoryAssignments?: any;
  userApprovedStageMappings?: any;
  jobsCreated?: number;
  totalJobs?: number;
}
