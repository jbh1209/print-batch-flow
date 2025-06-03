
import { ExistingTableName } from "@/config/productTypes";

// Define expected schemas for each table
export const tableSchemas: Record<ExistingTableName, string[]> = {
  'postcard_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date', 
    'size', 'paper_type', 'paper_weight', 'lamination_type', 'sides',
    'pdf_url', 'file_name', 'status', 'batch_id', 'created_at', 'updated_at'
  ],
  'poster_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date',
    'size', 'paper_type', 'paper_weight', 'lamination_type', 'sides',
    'pdf_url', 'file_name', 'status', 'batch_id', 'created_at', 'updated_at'
  ],
  'cover_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date',
    'paper_type', 'paper_weight', 'lamination_type', 'sides', 'uv_varnish',
    'pdf_url', 'file_name', 'status', 'batch_id', 'created_at', 'updated_at'
  ],
  'sticker_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date',
    'paper_type', 'lamination_type', 'pdf_url', 'file_name', 'status',
    'batch_id', 'created_at', 'updated_at'
  ],
  'box_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date',
    'paper_type', 'lamination_type', 'pdf_url', 'file_name', 'status',
    'batch_id', 'created_at', 'updated_at'
  ],
  'sleeve_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date',
    'stock_type', 'single_sided', 'pdf_url', 'file_name', 'status',
    'batch_id', 'created_at', 'updated_at'
  ],
  'flyer_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date',
    'size', 'paper_type', 'paper_weight', 'pdf_url', 'file_name', 'status',
    'batch_id', 'created_at', 'updated_at'
  ],
  'business_card_jobs': [
    'id', 'user_id', 'name', 'job_number', 'quantity', 'due_date',
    'paper_type', 'lamination_type', 'double_sided', 'pdf_url', 'file_name',
    'status', 'batch_id', 'uploaded_at', 'created_at', 'updated_at'
  ]
};

export const validateDataForTable = (tableName: string, data: Record<string, any>): string[] => {
  const schema = tableSchemas[tableName as ExistingTableName];
  if (!schema) {
    return [`Unknown table schema: ${tableName}`];
  }

  const errors: string[] = [];
  const dataKeys = Object.keys(data);
  
  // Check for fields that don't exist in the table
  for (const key of dataKeys) {
    if (!schema.includes(key)) {
      errors.push(`Field '${key}' does not exist in table '${tableName}'`);
    }
  }

  return errors;
};
