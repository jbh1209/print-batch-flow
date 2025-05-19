
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";
import { TableName } from "@/config/productTypes";

// Define concrete types with no recursion
interface OrphanedJob {
  id: string;
}

// Use explicit type definitions for Supabase responses
interface SupabaseQueryResult {
  data: OrphanedJob[] | null;
  error: Error | null;
}

interface SupabaseUpdateResult {
  error: Error | null;
}

export function useBatchFixes(tableName: TableName | undefined, userId: string | undefined) {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async () => {
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
      const result = await supabase
        .from(tableName)
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      // Use our concrete type for the result
      const queryResult = result as unknown as SupabaseQueryResult;
      const orphanedJobs = queryResult.data || [];
      const findError = queryResult.error;
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs.length} orphaned jobs in ${tableName}`);
      
      if (orphanedJobs.length > 0) {
        // Create an array of job IDs
        const jobIds = orphanedJobs.map(job => job.id);
        
        // Reset these jobs to queued status
        const update = await supabase
          .from(tableName)
          .update({ status: 'queued' })
          .in('id', jobIds);
        
        // Use our concrete type for update result
        const updateResult = update as unknown as SupabaseUpdateResult;
        const updateError = updateResult.error;
        
        if (updateError) throw updateError;
        
        fixedCount = orphanedJobs.length;
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
