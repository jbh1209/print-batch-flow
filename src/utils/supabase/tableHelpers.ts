
import { supabase } from '@/integrations/supabase/client';
import { isExistingTable } from '@/utils/database/tableValidation';

/**
 * Helper function to safely select data from a table without triggering complex type instantiation
 */
export async function safeSelectFromTable(tableName: string, columnName: string, condition: { field: string, value: any, operator?: 'eq' | 'is' } = { field: '', value: '' }) {
  // Validate table name
  if (!isExistingTable(tableName)) {
    console.error(`Invalid table name: ${tableName}`);
    return { data: null, error: new Error(`Invalid table: ${tableName}`) };
  }

  try {
    // Use direct query approach with "any" type casting to avoid deep type instantiation
    // This completely bypasses TypeScript's type checking for the Supabase client
    let query = (supabase.from(tableName as any) as any).select(columnName);
    
    // Apply condition if provided with valid field
    if (condition.field) {
      if (condition.operator === 'is') {
        query = query.is(condition.field, condition.value);
      } else {
        // Default to 'eq' if no operator specified
        query = query.eq(condition.field, condition.value);
      }
    }
    
    // Execute query
    const result = await query;
    return result;
  } catch (error) {
    console.error(`Error querying table ${tableName}:`, error);
    return { data: null, error };
  }
}

/**
 * Helper function to safely update data in a table without triggering complex type instantiation
 */
export async function safeUpdateInTable(tableName: string, updates: Record<string, any>, idField: string, idValues: string[]) {
  // Validate table name
  if (!isExistingTable(tableName)) {
    console.error(`Invalid table name: ${tableName}`);
    return { data: null, error: new Error(`Invalid table: ${tableName}`) };
  }

  try {
    // Use "any" type casting to bypass TypeScript's type checking
    const result = await (supabase
      .from(tableName as any) as any)
      .update(updates)
      .in(idField, idValues);
    
    return result;
  } catch (error) {
    console.error(`Error updating table ${tableName}:`, error);
    return { data: null, error };
  }
}

/**
 * Specialized function for fixing batched jobs without batch_id
 * Returns the number of fixed jobs
 */
export async function fixBatchedJobsWithoutBatchId(tableName: string): Promise<number> {
  if (!isExistingTable(tableName)) {
    console.error(`Invalid table name: ${tableName}`);
    return 0;
  }

  try {
    // Step 1: Find jobs with status 'batched' but NULL batch_id
    const { data: jobsWithoutBatch, error: fetchError } = await safeSelectFromTable(
      tableName,
      'id',
      { field: 'status', value: 'batched', operator: 'eq' }
    );
    
    // Filter jobs with null batch_id
    const filteredJobs = jobsWithoutBatch?.filter(job => !job.batch_id) || [];
    
    if (fetchError || !filteredJobs.length) {
      return 0;
    }
    
    // Step 2: Extract job IDs
    const jobIds = filteredJobs.map(job => job.id);
    
    // Step 3: Update these jobs to have status 'queued'
    const { error: updateError } = await safeUpdateInTable(
      tableName,
      { status: 'queued' },
      'id',
      jobIds
    );
    
    if (updateError) {
      return 0;
    }
    
    return filteredJobs.length;
  } catch (error) {
    console.error(`Error fixing batched jobs in ${tableName}:`, error);
    return 0;
  }
}
