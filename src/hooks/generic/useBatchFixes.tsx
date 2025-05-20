
import { useState } from 'react';
import { toast } from 'sonner';
import { BatchFixOperationResult } from '@/config/types/baseTypes';
import { isExistingTable } from '@/utils/database/tableValidation';
import { fixBatchedJobsWithoutBatchId } from '@/utils/supabase/tableHelpers';

export function useBatchFixes(tableName: string, userId?: string): BatchFixOperationResult {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async (): Promise<number> => {
    if (!tableName) {
      toast.error("Table name is required");
      return 0;
    }
    
    // Validate tableName before using it
    if (!isExistingTable(tableName)) {
      toast.error(`Invalid table name: ${tableName}`);
      return 0;
    }
    
    setIsFixingBatchedJobs(true);
    
    try {
      console.log(`Checking for jobs with status 'batched' but no batch_id in ${tableName}`);
      
      // Use our helper function to avoid type instantiation issues
      const fixedJobsCount = await fixBatchedJobsWithoutBatchId(tableName);
      
      if (fixedJobsCount > 0) {
        toast.success(`Fixed ${fixedJobsCount} jobs with incorrect batch status`);
      } else {
        console.log(`No batched jobs without batch_id found in ${tableName}`);
        toast.success('No issues found with batched jobs');
      }
      
      return fixedJobsCount;
    } catch (err) {
      console.error('Error in fixBatchedJobsWithoutBatch:', err);
      toast.error('An error occurred while fixing batched jobs');
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
