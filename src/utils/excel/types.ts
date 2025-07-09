
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
  // New timing and specification fields
  estimated_hours?: number | null;
  setup_time_minutes?: number | null;
  running_speed?: number | null;
  speed_unit?: string | null;
  specifications?: string | null;
  paper_weight?: string | null;
  paper_type?: string | null;
  lamination?: string | null;
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
