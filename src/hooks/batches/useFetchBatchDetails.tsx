
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BaseBatch, BaseJob } from '@/config/types/baseTypes';
import { toast } from 'sonner';
import { castToUUID } from '@/utils/database/dbHelpers';
import { adaptBatchFromDb, adaptJobArrayFromDb } from '@/utils/database/typeAdapters';

export function useFetchBatchDetails(batchId: string | undefined, jobsTableName: string) {
  const [batch, setBatch] = useState<BaseBatch | null>(null);
  const [jobs, setJobs] = useState<BaseJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatchDetails = async () => {
      if (!batchId) return;
      
      try {
        setIsLoading(true);
        
        // Fetch batch details
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('*')
          .eq('id', castToUUID(batchId))
          .single();
        
        if (batchError) {
          console.error("Error fetching batch:", batchError);
          throw batchError;
        }
        
        // Process batch data
        const processedBatch = adaptBatchFromDb<BaseBatch>(batchData);
        setBatch(processedBatch);
        
        // Fetch jobs related to this batch
        const { data: jobsData, error: jobsError } = await supabase
          .from(jobsTableName)
          .select('*')
          .eq('batch_id', castToUUID(batchId));
          
        if (jobsError) {
          console.error("Error fetching jobs:", jobsError);
          throw jobsError;
        }
        
        // Process jobs data
        const processedJobs = adaptJobArrayFromDb<BaseJob>(jobsData);
        setJobs(processedJobs);
        
      } catch (err) {
        console.error("Error fetching batch details:", err);
        setError("Failed to load batch details");
        toast.error("Error loading batch details");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBatchDetails();
  }, [batchId, jobsTableName]);

  return {
    batch,
    jobs,
    isLoading,
    error
  };
}
