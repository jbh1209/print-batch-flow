
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFlyerBatchFix(onJobsUpdated: () => Promise<void>) {
  const { user } = useAuth();
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  // Fix jobs that are marked as batched but have no batch_id
  const fixBatchedJobsWithoutBatch = async () => {
    if (!user) {
      console.log("No authenticated user found for fix operation");
      return;
    }
    
    setIsFixingBatchedJobs(true);
    try {
      console.log("Finding orphaned batched jobs");
      
      // Find all jobs that are marked as batched but have no batch_id
      const { data: orphanedJobs, error: findError } = await supabase
        .from('flyer_jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) {
        console.error("Error finding orphaned jobs:", findError);
        throw findError;
      }
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Reset these jobs to queued status
        const { error: updateError } = await supabase
          .from('flyer_jobs')
          .update({ status: 'queued' })
          .in('id', orphanedJobs.map(job => job.id));
        
        if (updateError) {
          console.error("Error fixing orphaned jobs:", updateError);
          throw updateError;
        }
        
        console.log(`Reset ${orphanedJobs.length} jobs to queued status`);
        
        toast.success(`Reset ${orphanedJobs.length} orphaned jobs back to queued status`);
        
        // Refresh the job list
        await onJobsUpdated();
      }
    } catch (error) {
      console.error('Error fixing batched jobs:', error);
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
