
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";
import { TableName } from "@/config/productTypes";

// Define explicit interfaces to avoid recursive type instantiation
interface OrphanedJob {
  id: string;
}

// Define proper interfaces for Supabase query results
interface SupabaseQueryData<T> {
  data: T[] | null;
  error: Error | null;
}

// Define update result interface
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
      // Use properly typed interfaces to avoid recursive type issues
      const queryResult = await supabase
        .from(tableName)
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      // Safely cast the result to our properly defined interface
      const result = queryResult as unknown as SupabaseQueryData<OrphanedJob>;
      const orphanedJobs = result.data;
      const findError = result.error;
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs in ${tableName}`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Create an array of job IDs
        const jobIds = orphanedJobs.map(job => job.id);
        
        // Reset these jobs to queued status
        // Use properly typed interfaces to avoid recursive type issues
        const updateQueryResult = await supabase
          .from(tableName)
          .update({ status: 'queued' })
          .in('id', jobIds);
        
        // Safely cast the update result
        const updateResult = updateQueryResult as unknown as SupabaseUpdateResult;
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
