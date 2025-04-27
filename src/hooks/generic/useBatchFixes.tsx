
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TableName } from '@/config/productTypes';
import { isExistingTable } from '@/utils/database/tableUtils';

interface JobWithId {
  id: string;
}

export function useBatchFixes(tableName: TableName | undefined, userId: string | undefined) {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async () => {
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
      
      // Use 'as any' to bypass TypeScript's type checking for the table name
      const { data: orphanedJobs, error: findError } = await supabase
        .from(tableName as any)
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Fixed: Use a safer approach for extracting job IDs
        const jobIds = (orphanedJobs as unknown[])
          .filter((job): job is JobWithId => 
            job !== null && 
            typeof job === 'object' && 
            job !== undefined && 
            'id' in job && 
            typeof job.id === 'string'
          )
          .map(job => job.id);
        
        if (jobIds.length === 0) {
          console.log("No valid job IDs found to update");
          return;
        }
        
        // Use 'as any' to bypass TypeScript's type checking for the table name
        const { error: updateError } = await supabase
          .from(tableName as any)
          .update({ status: 'queued' })
          .in('id', jobIds);
        
        if (updateError) throw updateError;
        
        console.log(`Reset ${jobIds.length} jobs to queued status`);
        toast.success(`Reset ${jobIds.length} orphaned jobs back to queued status`);
        
        return jobIds.length;
      }
    } catch (error) {
      console.error(`Error fixing batched jobs:`, error);
      toast.error(`Failed to reset jobs with missing batch references.`);
    } finally {
      setIsFixingBatchedJobs(false);
    }
  };

  return {
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  };
}
