
import { supabase } from "@/integrations/supabase/client";
import { ExistingTableName } from "@/config/productTypes";
import { 
  JobDatabaseItem, 
  LinkedJobResult, 
  BatchVerificationResult,
  VerifyBatchLinksParams,
  SelectQueryError,
  QueryResultItem
} from "@/hooks/generic/batch-operations/types/batchVerificationTypes";

/**
 * Helper function to determine if an object is a valid job database item
 */
export function isValidJobItem(item: unknown): item is JobDatabaseItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    'id' in item && 
    item.id !== undefined && 
    item.id !== null
  );
}

/**
 * Helper function to check if an item is an error object
 */
export function isQueryError(item: unknown): item is SelectQueryError {
  return (
    item !== null &&
    typeof item === 'object' &&
    'error' in item && 
    (item as any).error === true
  );
}

/**
 * Safely converts a database item to a typed LinkedJobResult
 */
export function convertToLinkedJobResult(item: JobDatabaseItem): LinkedJobResult {
  // Convert id to string (handles both string and number types)
  const id = String(item.id);
  
  // Handle batch_id which might be undefined or null
  let batchId: string | null = null;
  if ('batch_id' in item && item.batch_id !== undefined && item.batch_id !== null) {
    batchId = String(item.batch_id);
  }
  
  // Return safely typed result
  return { id, batch_id: batchId };
}

/**
 * Verifies if jobs were linked to a batch properly - simplified for all-user access
 */
export async function verifyBatchJobLinks({
  jobIds,
  batchId,
  tableName
}: VerifyBatchLinksParams): Promise<BatchVerificationResult> {
  // Initialize result
  const result: BatchVerificationResult = {
    success: true,
    linkedJobs: [],
    unlinkedJobs: [],
    errors: []
  };
  
  if (jobIds.length === 0) {
    return result; // Nothing to verify
  }
  
  try {
    // Query database to verify job updates - no user filtering
    const { data: updatedJobsData, error: verifyError } = await supabase
      .from(tableName)
      .select("id, batch_id")
      .in("id", jobIds);
    
    if (verifyError) {
      console.error("Error verifying job updates:", verifyError);
      result.success = false;
      result.errors.push({
        jobId: "query",
        message: verifyError.message
      });
      return result;
    }
    
    // Early return if no data
    if (!updatedJobsData || !Array.isArray(updatedJobsData)) {
      result.success = false;
      return result;
    }

    // First, filter out any potential error objects and keep only valid job items
    const validJobItems: JobDatabaseItem[] = [];
    
    updatedJobsData.forEach(item => {
      if (isValidJobItem(item) && !isQueryError(item)) {
        validJobItems.push(item);
      } else if (isQueryError(item)) {
        console.warn("Query returned an error item:", item);
        result.errors.push({
          jobId: "data",
          message: (item as SelectQueryError)?.details || "Unknown data error"
        });
      }
    });
    
    // Now map the valid items to the correct format
    const typedJobResults: LinkedJobResult[] = validJobItems.map(item => convertToLinkedJobResult(item));
      
    // Separate linked and unlinked jobs
    result.linkedJobs = typedJobResults.filter(job => job.batch_id === batchId);
    result.unlinkedJobs = typedJobResults.filter(job => job.batch_id !== batchId);
    
    // Update success status based on whether all jobs were linked
    result.success = result.unlinkedJobs.length === 0;
    
    return result;
  } catch (error) {
    console.error("Exception in verification process:", error);
    result.success = false;
    result.errors.push({
      jobId: "verification",
      message: error instanceof Error ? error.message : "Unknown error during verification"
    });
    return result;
  }
}

/**
 * Attempts to relink jobs that weren't properly linked to a batch
 */
export async function relinkJobs(
  unlinkedJobs: LinkedJobResult[],
  batchId: string,
  tableName: ExistingTableName
): Promise<{success: boolean, relinked: number, failed: number}> {
  let relinked = 0;
  let failed = 0;
  
  if (unlinkedJobs.length === 0) {
    return { success: true, relinked, failed };
  }
  
  // Process each unlinked job individually for more detailed error handling
  for (const job of unlinkedJobs) {
    try {
      const { error } = await supabase
        .from(tableName)
        .update({
          status: "batched",
          batch_id: batchId
        })
        .eq("id", job.id);
      
      if (error) {
        console.error(`Failed to relink job ${job.id}:`, error);
        failed++;
      } else {
        console.log(`Successfully relinked job ${job.id}`);
        relinked++;
      }
    } catch (error) {
      console.error(`Exception when trying to relink job:`, error);
      failed++;
    }
  }
  
  return {
    success: failed === 0,
    relinked,
    failed
  };
}
