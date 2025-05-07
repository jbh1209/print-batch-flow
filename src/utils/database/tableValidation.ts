
/**
 * Utility functions to validate database tables and operations
 */

/**
 * Check if a table exists in the database schema
 * @param tableName The name of the table to check
 * @returns True if the table exists, false otherwise
 */
export const isExistingTable = (tableName: string): boolean => {
  const validTables = [
    'batches',
    'business_card_jobs',
    'flyer_jobs',
    'box_jobs',
    'postcard_jobs',
    'cover_jobs',
    'poster_jobs',
    'sleeve_jobs',
    'sticker_jobs',
    'profiles',
    'user_roles',
    'app_settings'
  ];
  
  return validTables.includes(tableName);
};

/**
 * Check if a column exists in a table
 * @param tableName The name of the table to check
 * @param columnName The name of the column to check
 * @returns True if the column exists in the table, false otherwise
 */
export const isExistingColumn = (tableName: string, columnName: string): boolean => {
  // Mapping of tables to their columns
  const tableColumns: Record<string, string[]> = {
    'batches': [
      'id', 'name', 'status', 'sheets_required', 'front_pdf_url', 
      'back_pdf_url', 'due_date', 'created_at', 'created_by',
      'lamination_type', 'paper_type', 'paper_weight', 'updated_at'
    ],
    'business_card_jobs': [
      'id', 'name', 'status', 'quantity', 'pdf_url', 'file_name',
      'due_date', 'batch_id', 'user_id', 'created_at', 'updated_at',
      'double_sided', 'lamination_type', 'paper_type', 'job_number'
    ],
    // Add more tables and their columns as needed
  };
  
  // Check if the table exists and has the specified column
  return tableColumns[tableName]?.includes(columnName) ?? false;
};

/**
 * Get all column names for a table
 * @param tableName The name of the table
 * @returns Array of column names, or empty array if the table doesn't exist
 */
export const getTableColumns = (tableName: string): string[] => {
  // Mapping of tables to their columns
  const tableColumns: Record<string, string[]> = {
    'batches': [
      'id', 'name', 'status', 'sheets_required', 'front_pdf_url', 
      'back_pdf_url', 'due_date', 'created_at', 'created_by',
      'lamination_type', 'paper_type', 'paper_weight', 'updated_at'
    ],
    'business_card_jobs': [
      'id', 'name', 'status', 'quantity', 'pdf_url', 'file_name',
      'due_date', 'batch_id', 'user_id', 'created_at', 'updated_at',
      'double_sided', 'lamination_type', 'paper_type', 'job_number'
    ],
    // Add more tables and their columns as needed
  };
  
  return tableColumns[tableName] || [];
};
