
import { ExistingTableName } from "@/config/productTypes";

/**
 * Represents a linked job result from database query
 */
export interface LinkedJobResult {
  id: string;
  batch_id: string | null;
}

/**
 * Raw database item structure from Supabase query results
 */
export interface JobDatabaseItem {
  id: string | number;
  batch_id?: string | number | null;
  [key: string]: any; // Allow other properties
}

/**
 * Error result for job verification
 */
export interface JobVerificationError {
  jobId: string;
  message: string;
}

/**
 * Possible error format returned from Supabase
 */
export interface SelectQueryError {
  error: true;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Union type for potential response items from Supabase query
 */
export type QueryResultItem = JobDatabaseItem | SelectQueryError;

/**
 * Result of verifying batch job links
 */
export interface BatchVerificationResult {
  success: boolean;
  linkedJobs: LinkedJobResult[];
  unlinkedJobs: LinkedJobResult[];
  errors: JobVerificationError[];
}

/**
 * Parameters for verifying batch job links
 */
export interface VerifyBatchLinksParams {
  jobIds: string[];
  batchId: string;
  tableName: ExistingTableName;
}
