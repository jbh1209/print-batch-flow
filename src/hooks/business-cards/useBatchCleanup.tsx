
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useBatchCleanup = () => {
  const { toast } = useToast();
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async () => {
    setIsFixingBatchedJobs(true);
    try {
      const { data: orphanedJobs, error: findError } = await supabase
        .from('business_card_jobs')
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        const { error: updateError } = await supabase
          .from('business_card_jobs')
          .update({ status: 'queued' })
          .in('id', orphanedJobs.map(job => job.id));
        
        if (updateError) throw updateError;
        
        toast({
          title: "Jobs fixed",
          description: `Reset ${orphanedJobs.length} orphaned jobs back to queued status`,
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
