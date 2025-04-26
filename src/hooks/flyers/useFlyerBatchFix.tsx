
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
      
      // Explicitly define the response type to avoid deep instantiation issue
      const response = await supabase
        .from("flyer_jobs")
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null) as { data: any[] | null; error: any };
      
      if (response.error) throw response.error;
      
      const jobsData = response.data || [];
      
      console.log(`Found ${jobsData.length} orphaned flyer jobs`);
      
      if (jobsData.length > 0) {
        // Extract IDs
        const jobIds = jobsData.map(job => job.id);
        
        // Explicitly define the update response type
        const updateResponse = await supabase
          .from("flyer_jobs")
          .update({ status: 'queued' })
          .in('id', jobIds) as { error: any };
        
        if (updateResponse.error) throw updateResponse.error;
        
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
