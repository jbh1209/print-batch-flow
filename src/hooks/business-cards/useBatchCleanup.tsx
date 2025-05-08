
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createUpdateData, castToUUID, safeDbMap, toSafeString } from "@/utils/database/dbHelpers";

export const useBatchCleanup = () => {
  const { toast } = useToast();
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async () => {
    setIsFixingBatchedJobs(true);
    try {
      const { data: orphanedJobs, error: findError } = await supabase
        .from('business_card_jobs')
        .select('id')
        .eq("status", castToUUID("batched") as any)
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Create a properly typed update payload
        const updateData = createUpdateData({
          status: "queued"
        });
        
        // Map job IDs safely for the 'in' clause
        const jobIds = safeDbMap(orphanedJobs, job => toSafeString(job.id));
        
        const { error: updateError } = await supabase
          .from('business_card_jobs')
          .update(updateData)
          .in('id', jobIds as any);
        
        if (updateError) throw updateError;
        
        toast({
          title: "Jobs fixed",
          description: `Reset ${jobIds.length} orphaned jobs back to queued status`,
        });
      }
    } catch (error) {
      console.error('Error fixing batched jobs:', error);
      toast({
        title: "Error fixing jobs",
        description: "Failed to reset jobs with missing batch references.",
        variant: "destructive",
      });
    } finally {
      setIsFixingBatchedJobs(false);
    }
  };

  return {
    isFixingBatchedJobs,
    fixBatchedJobsWithoutBatch,
  };
};
