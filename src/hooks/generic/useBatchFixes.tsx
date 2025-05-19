
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";
import { TableName } from "@/config/productTypes";
import { BatchFixOperationResult } from "@/config/types/baseTypes";

/**
 * Interface for job records with ID
 */
interface JobId {
  id: string;
}

/**
 * Hook to fix orphaned batched jobs (jobs with batch status but no batch ID)
 */
export function useBatchFixes(tableName: TableName | undefined, userId: string | undefined): BatchFixOperationResult {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async (): Promise<number> => {
    if (!tableName) {
      console.log("No table name specified for batch fix");
      return 0;
    }
    
    if (!isExistingTable(tableName)) {
      console.log(`Table ${tableName} doesn't exist yet, skipping batch fix`);
      return 0;
    }
    
    setIsFixingBatchedJobs(true);
    let fixedCount = 0;
    
    try {
      console.log(`Finding orphaned batched jobs in ${tableName}`);
      
      // Find all jobs that are marked as batched but have no batch_id
      const { data, error: findError } = await supabase
        .from(tableName)
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      // Use a simple array with type assertion instead of complex type inference
      const jobsToUpdate = Array.isArray(data) ? data as JobId[] : [];
      const jobIds = jobsToUpdate.map(job => job.id);
      
      console.log(`Found ${jobsToUpdate.length} orphaned jobs in ${tableName}`);
      
      if (jobsToUpdate.length > 0) {
        // Reset these jobs to queued status
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ status: 'queued' })
          .in('id', jobIds);
        
        if (updateError) throw updateError;
        
        fixedCount = jobsToUpdate.length;
        console.log(`Reset ${fixedCount} jobs to queued status`);
        
        toast.success(`Reset ${fixedCount} orphaned jobs back to queued status`);
      }
      
      return fixedCount;
    } catch (error) {
      console.error(`Error fixing batched jobs in ${tableName}:`, error);
      toast.error(`Failed to reset jobs with missing batch references`);
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
