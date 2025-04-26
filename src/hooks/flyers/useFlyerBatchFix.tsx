
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFlyerBatchFix(onSuccess?: () => Promise<void>) {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  // Update to return Promise<number> for consistency with other implementations
  const fixBatchedJobsWithoutBatch = async (): Promise<number> => {
    try {
      setIsFixingBatchedJobs(true);
      console.log("Finding orphaned flyer batched jobs");
      
      // Use simple type casting to avoid deep instantiation issues
      const { data, error } = await supabase
        .from("flyer_jobs")
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null) as { data: { id: string }[] | null; error: any };
      
      if (error) throw error;
      
      const jobsData = data || [];
      
      console.log(`Found ${jobsData.length} orphaned flyer jobs`);
      
      if (jobsData.length > 0) {
        // Extract IDs
        const jobIds = jobsData.map(job => job.id);
        
        // Use simple type casting
        const { error: updateError } = await supabase
          .from("flyer_jobs")
          .update({ status: 'queued' })
          .in('id', jobIds) as { error: any };
        
        if (updateError) throw updateError;
        
        console.log(`Reset ${jobIds.length} flyer jobs to queued status`);
        toast.success(`Reset ${jobIds.length} orphaned flyer jobs back to queued status`);
        
        // Call the onSuccess callback if provided
        if (onSuccess) {
          await onSuccess();
        }
        
        return jobIds.length;
      }
      
      return 0;
    } catch (error) {
      console.error("Error fixing batched flyer jobs:", error);
      toast.error("Failed to reset flyer jobs with missing batch references.");
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
