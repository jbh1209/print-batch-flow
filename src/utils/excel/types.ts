
export interface ParsedJob {
  wo_no: string;
  status: string;
  date: string;
  rep: string;
  category: string;
  customer: string;
  reference: string;
  qty: number;
  due_date: string;
  location: string;
}

export interface ImportStats {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  invalidWONumbers: number;
  invalidDates: number;
}

export interface ParsedData {
  jobs: ParsedJob[];
  stats: ImportStats;
}
