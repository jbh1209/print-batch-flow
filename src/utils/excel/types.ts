
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
  operation_quantities?: OperationQuantities | null;
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
    quantity_type?: 'pieces' | 'sheets' | 'operations';
  };
}

export interface QuantityTypeMapping {
  qtyColumn: 'pieces' | 'sheets' | 'operations';
  woQtyColumn: 'pieces' | 'sheets' | 'operations';
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
  qtyType?: 'pieces' | 'sheets' | 'operations';
  woQtyType?: 'pieces' | 'sheets' | 'operations';
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
