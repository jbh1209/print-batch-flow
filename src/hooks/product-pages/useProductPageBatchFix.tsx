
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";
import { PRODUCT_PAGES_TABLE } from "@/components/product-pages/types/ProductPageTypes";

// Define concrete non-recursive interfaces
interface OrphanedProductPageJob {
  id: string;
}

// Use simple, concrete types for Supabase results
interface ProductPageQueryResult {
  data: OrphanedProductPageJob[] | null;
  error: Error | null;
}

interface ProductPageUpdateResult {
  error: Error | null;
}

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
      const result = await supabase
        .from(PRODUCT_PAGES_TABLE)
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      // Use concrete type to avoid recursion
      const queryResult = result as unknown as ProductPageQueryResult;
      const orphanedJobs = queryResult.data || [];
      const findError = queryResult.error;
      
      if (findError) throw findError;
      
      console.log(`Found ${orphanedJobs.length} orphaned jobs in ${PRODUCT_PAGES_TABLE}`);
      
      if (orphanedJobs.length > 0) {
        // Create array of job IDs
        const jobIds = orphanedJobs.map(job => job.id);
        
        // Use a properly typed update object
        const updateData = { status: 'queued' } as const;
        
        const update = await supabase
          .from(PRODUCT_PAGES_TABLE)
          .update(updateData)
          .in('id', jobIds);
        
        // Use concrete type for update result
        const updateResult = update as unknown as ProductPageUpdateResult;
        const updateError = updateResult.error;
        
        if (updateError) throw updateError;
        
        fixedCount = orphanedJobs.length;
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
