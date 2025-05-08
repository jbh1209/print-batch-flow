
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TableName } from '@/config/productTypes';
import { isExistingTable } from '@/utils/database/tableValidation';
import { 
  castToUUID, 
  prepareUpdateParams,
  safeDbMap,
  toSafeString,
  safeGetId
} from '@/utils/database/dbHelpers';

interface JobWithId {
  id: string;
}

export function useBatchFixes(tableName: TableName | undefined, userId: string | undefined) {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  /**
   * Fixes jobs that are marked as batched but have no batch_id
   * @returns Promise<number | undefined> - The number of jobs fixed or undefined if no jobs needed fixing
   */
  const fixBatchedJobsWithoutBatch = async (): Promise<number | undefined> => {
    if (!userId || !tableName) {
      console.log("No authenticated user or table name found for fix operation");
      return;
    }
    
    try {
      setIsFixingBatchedJobs(true);
      console.log("Finding orphaned batched jobs");
      
      if (!isExistingTable(tableName)) {
        console.log(`Table ${tableName} doesn't exist yet, skipping fix operation`);
        return;
      }
      
      // Use proper type casting for table name and status
      const batchedStatus = 'batched' as any;
      
      // Use 'as any' to bypass TypeScript's type checking for the table name
      const { data: orphanedJobs, error: findError } = await supabase
        .from(tableName as any)
        .select('id')
        .eq('user_id', castToUUID(userId))
        .eq('status', batchedStatus)
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Create properly typed update parameters
        const updateParams = prepareUpdateParams({ status: 'queued' as any });
        
        // Extract all job IDs from the orphaned jobs and ensure they are valid
        const jobIds = safeDbMap(orphanedJobs, job => safeGetId(job));
        const validJobIds = jobIds.filter(id => id !== '');
        
        if (validJobIds.length === 0) {
          console.log("No valid job IDs found to update");
          return 0;
        }
        
        // Use 'as any' to bypass TypeScript's type checking for the table name
        const { error: updateError } = await supabase
          .from(tableName as any)
          .update(updateParams)
          .in('id', validJobIds as any);
        
        if (updateError) throw updateError;
        
        console.log(`Reset ${validJobIds.length} jobs to queued status`);
        toast.success(`Reset ${validJobIds.length} orphaned jobs back to queued status`);
        
        return validJobIds.length;
      }
      
      return 0;
    } catch (error) {
      console.error(`Error fixing batched jobs:`, error);
      toast.error(`Failed to reset jobs with missing batch references.`);
      return 0;
    } finally {
      setIsFixingBatchedJobs(false);
    }
  };

  return {
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  };
}
