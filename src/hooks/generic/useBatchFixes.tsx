
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
      
      // Explicitly type as any to avoid deep type instantiation
      const result: any = await supabase
        .from(table)
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      const { data, error } = result;
      
      if (error) throw error;
      
      // Simple array typing
      const jobsData = data || [];
      
      console.log(`Found ${jobsData.length} orphaned jobs`);
      
      if (jobsData.length > 0) {
        // Extract IDs as simple strings
        const jobIds = jobsData.map((job: JobWithId) => job.id);
        
        // Type the update operation result as any
        const updateResult: any = await supabase
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
