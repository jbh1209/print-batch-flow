
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";
import { PRODUCT_PAGES_TABLE } from "@/components/product-pages/types/ProductPageTypes";

export function useProductPageBatchFix(onFixComplete?: () => void) {
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  const fixBatchedJobsWithoutBatch = async () => {
    if (!isExistingTable(PRODUCT_PAGES_TABLE)) {
      console.log(`Table ${PRODUCT_PAGES_TABLE} doesn't exist yet, skipping batch fix`);
      return 0;
    }
    
    setIsFixingBatchedJobs(true);
    let fixedCount = 0;
    
    try {
      console.log(`Finding orphaned batched jobs in ${PRODUCT_PAGES_TABLE}`);
      
      // Find all jobs that are marked as batched but have no batch_id
      const { data: orphanedJobs, error: findError } = await supabase
        .from(PRODUCT_PAGES_TABLE)
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      // Handle the case where data might be null
      const jobsToUpdate = orphanedJobs || [];
      console.log(`Found ${jobsToUpdate.length} orphaned jobs in ${PRODUCT_PAGES_TABLE}`);
      
      if (jobsToUpdate.length > 0) {
        // Create array of job IDs
        const jobIds = jobsToUpdate.map(job => job.id);
        
        // Reset these jobs to queued status
        const { error: updateError } = await supabase
          .from(PRODUCT_PAGES_TABLE)
          .update({ status: 'queued' })
          .in('id', jobIds);
        
        if (updateError) throw updateError;
        
        fixedCount = jobsToUpdate.length;
        console.log(`Reset ${fixedCount} jobs to queued status`);
        
        toast.success(`Reset ${fixedCount} orphaned jobs back to queued status`);
      }
      
      // Call the callback function if provided
      if (onFixComplete) {
        onFixComplete();
      }
      
      return fixedCount;
    } catch (error) {
      console.error(`Error fixing batched jobs in ${PRODUCT_PAGES_TABLE}:`, error);
      toast.error(`Failed to reset jobs with missing batch references`);
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
