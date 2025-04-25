
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TableName } from '@/config/productTypes';
import { isExistingTable, getSupabaseTable } from '@/utils/database/tableUtils';

// Simple interface for jobs with ID
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
      
      // Get the valid table name
      const table = getSupabaseTable(tableName);
      
      // Use raw query and explicit types to avoid type instantiation issues
      const { data, error: findError } = await supabase
        .from(table)
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      // Convert to a simple array without complex typing
      const jobsArray = Array.isArray(data) ? data : [];
      console.log(`Found ${jobsArray.length} orphaned jobs`);
      
      if (jobsArray.length > 0) {
        // Extract IDs as simple strings
        const jobIds = jobsArray
          .filter(job => job && typeof job === 'object' && 'id' in job)
          .map(job => job.id);
        
        if (jobIds.length === 0) {
          console.log("No valid job IDs found to update");
          return;
        }
        
        // Simple update query with no complex types
        const { error: updateError } = await supabase
          .from(table)
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
