
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BatchFixOperationResult, ExistingTableName } from '@/config/types/baseTypes';
import { isExistingTable } from '@/utils/database/tableValidation';

// Define a simple interface for job records to avoid complex type instantiation
interface JobRecord {
  id: string;
}

export function useBatchFixes(tableName: string, userId?: string): BatchFixOperationResult {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async (): Promise<number> => {
    if (!tableName) {
      toast.error("Table name is required");
      return 0;
    }
    
    // Validate tableName before using it with Supabase
    if (!isExistingTable(tableName)) {
      toast.error(`Invalid table name: ${tableName}`);
      return 0;
    }
    
    setIsFixingBatchedJobs(true);
    
    try {
      console.log(`Checking for jobs with status 'batched' but no batch_id in ${tableName}`);
      
      // Safely use the table name after validation - avoid complex type logic
      // This prevents excessive type instantiation
      const table = tableName;
      
      // First, fetch all jobs with status 'batched' but NULL batch_id
      const { data: jobsWithoutBatch, error: fetchError } = await supabase
        .from(table)
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (fetchError) {
        console.error('Error fetching batched jobs without batch_id:', fetchError);
        toast.error(`Error checking for jobs: ${fetchError.message}`);
        return 0;
      }
      
      // If no problematic jobs found, return early
      if (!jobsWithoutBatch || jobsWithoutBatch.length === 0) {
        console.log(`No batched jobs without batch_id found in ${tableName}`);
        toast.success('No issues found with batched jobs');
        return 0;
      }
      
      console.log(`Found ${jobsWithoutBatch.length} jobs with status 'batched' but no batch_id`);
      
      // Get the IDs of the problematic jobs - use simple typing
      const jobIds = jobsWithoutBatch.map((job: JobRecord) => job.id);
      
      // Update these jobs to have status 'queued' instead
      const { error: updateError } = await supabase
        .from(table)
        .update({ status: 'queued' })
        .in('id', jobIds);
      
      if (updateError) {
        console.error('Error fixing batched jobs:', updateError);
        toast.error(`Error fixing jobs: ${updateError.message}`);
        return 0;
      }
      
      toast.success(`Fixed ${jobsWithoutBatch.length} jobs with incorrect batch status`);
      return jobsWithoutBatch.length;
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
