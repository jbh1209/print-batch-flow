
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";
import { TableName } from "@/config/productTypes";

// Define a basic interface for jobs with id property to avoid type recursion
interface OrphanedJob {
  id: string;
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
      // Removed user_id filter to allow all users to fix orphaned jobs
      const { data: orphanedJobs, error: findError } = await supabase
        .from(tableName)
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs in ${tableName}`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Explicitly type the orphaned jobs to prevent recursive type issues
        const typedJobs = orphanedJobs as OrphanedJob[];
        const jobIds = typedJobs.map(job => job.id);
        
        // Reset these jobs to queued status
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ status: 'queued' })
          .in('id', jobIds);
        
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
