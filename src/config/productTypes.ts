import { JobStatus } from "@/components/business-cards/JobsTable";

export interface ProductConfig {
  productType: string;
  tableName: string;
  hasSize: boolean;
  hasPaperType: boolean;
  ui: {
    color: string;
  };
  fields: {
    [key: string]: {
      label: string;
    };
  };
}

export interface BaseJob {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  due_date: string;
  created_at: string;
  status: JobStatus;
  pdf_url: string;
  reference?: string;
  // Optional fields that may exist on some job types
  size?: string;
  paper_type?: string;
  lamination_type?: string;
}
