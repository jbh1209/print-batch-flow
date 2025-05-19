
import { TableName } from "@/config/productTypes";

// Status types
export type ProductPageStatus = 'queued' | 'batched' | 'completed' | 'cancelled' | 'sent_to_print';

// Field types supported in templates
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'checkbox' | 'file';

// Field definition in a template
export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  label: string;
  placeholder?: string;
  defaultValue?: any;
  options?: string[]; // For select fields
  min?: number;      // For number fields
  max?: number;      // For number fields
  description?: string;
}

// Product Page Template
export interface ProductPageTemplate {
  id: string;
  name: string;
  description?: string;
  fields: FieldDefinition[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Product Page Job
export interface ProductPageJob {
  id: string;
  template_id: string;
  name: string;
  job_number: string;
  status: ProductPageStatus;
  batch_id: string | null;
  user_id: string;
  pdf_url: string | null;
  file_name: string | null;
  due_date: string;
  custom_fields: Record<string, any>;
  quantity: number;
  created_at: string;
  updated_at: string;
}

// Product Page Batch
export interface ProductPageBatch {
  id: string;
  name: string;
  status: string;
  due_date: string;
  sheets_required: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  paper_type?: string;
  paper_weight?: string;
  printer_type?: string;
  sheet_size?: string;
  overview_pdf_url?: string | null;
  front_pdf_url?: string | null;
  back_pdf_url?: string | null;
  sla_target_days?: number;
}

// Form values for creating a product page job
export interface ProductPageFormValues {
  name: string;
  job_number: string;
  template_id: string;
  quantity: number;
  due_date: Date;
  file?: File;
  custom_fields: Record<string, any>;
}

// Table name for product pages
export const PRODUCT_PAGES_TABLE = "product_pages";
export const PRODUCT_PAGE_TEMPLATES_TABLE = "product_page_templates";
