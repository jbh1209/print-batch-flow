
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

  const fixBatchedJobsWithoutBatch = async (): Promise<number> => {
    if (!userId || !tableName) {
      console.log("No authenticated user or table name found for fix operation");
      return 0;
    }
    
    try {
      setIsFixingBatchedJobs(true);
      console.log("Finding orphaned batched jobs");
      
      if (!isExistingTable(tableName)) {
        console.log(`Table ${tableName} doesn't exist yet, skipping fix operation`);
        return 0;
      }
      
      // Get the valid table name
      const table = getSupabaseTable(tableName);
      
      // Using a simple type annotation rather than complex generic typing
      const result = await supabase
        .from(table)
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      // Use non-generic typing to simplify
      const data = result.data || [];
      const error = result.error;
      
      if (error) throw error;
      
      console.log(`Found ${data.length} orphaned jobs`);
      
      if (data.length > 0) {
        // Extract IDs as simple strings
        const jobIds = data.map((job: JobWithId) => job.id);
        
        // Simple typing for update operation
        const updateResult = await supabase
          .from(table)
          .update({ status: 'queued' })
          .in('id', jobIds);
        
        if (updateResult.error) throw updateResult.error;
        
        console.log(`Reset ${jobIds.length} jobs to queued status`);
        toast.success(`Reset ${jobIds.length} orphaned jobs back to queued status`);
        
        return jobIds.length;
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
