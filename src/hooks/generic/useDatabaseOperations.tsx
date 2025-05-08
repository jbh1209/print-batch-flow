
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TableName, BaseBatch, BaseJob } from '@/config/productTypes';
import { isExistingTable } from '@/utils/database/tableValidation';
import { castToUUID, prepareUpdateParams } from '@/utils/database/dbHelpers';
import { adaptBatchFromDb, adaptJobFromDb, prepareBatchForDb, prepareJobForDb } from '@/utils/database/typeAdapters';

export function useDatabaseOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Safely fetch a batch by ID
   */
  const fetchBatchById = async <T extends BaseBatch>(
    batchId: string
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', castToUUID(batchId))
        .single();
        
      if (fetchError) {
        console.error('Error fetching batch:', fetchError);
        setError(`Failed to load batch details: ${fetchError.message}`);
        return null;
      }
      
      return adaptBatchFromDb<T>(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in fetchBatchById:', err);
      setError(`Failed to fetch batch: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Safely fetch jobs related to a batch
   */
  const fetchJobsByBatchId = async <T extends BaseJob>(
    tableName: TableName,
    batchId: string
  ): Promise<T[]> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isExistingTable(tableName)) {
        setError(`Table ${tableName} does not exist`);
        return [];
      }

      const { data, error: fetchError } = await supabase
        .from(tableName as any)
        .select('*')
        .eq('batch_id', castToUUID(batchId));
        
      if (fetchError) {
        console.error('Error fetching jobs for batch:', fetchError);
        setError(`Failed to load jobs: ${fetchError.message}`);
        return [];
      }
      
      if (!data || !Array.isArray(data)) {
        return [];
      }
      
      // Convert to properly typed objects
      return data
        .map(job => adaptJobFromDb<T>(job))
        .filter((job): job is T => job !== null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in fetchJobsByBatchId:', err);
      setError(`Failed to fetch jobs: ${errorMessage}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create a batch with proper type handling
   */
  const createBatch = async <T extends BaseBatch>(
    batchData: Partial<BaseBatch>
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Prepare batch data for insertion
      const preparedData = prepareBatchForDb(batchData);

      const { data, error: insertError } = await supabase
        .from('batches')
        .insert(preparedData)
        .select()
        .single();
        
      if (insertError) {
        console.error('Error creating batch:', insertError);
        setError(`Failed to create batch: ${insertError.message}`);
        toast.error('Failed to create batch');
        return null;
      }
      
      // Convert to proper type
      const createdBatch = adaptBatchFromDb<T>(data);
      
      if (!createdBatch) {
        setError('Failed to process created batch data');
        return null;
      }
      
      toast.success('Batch created successfully');
      return createdBatch;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in createBatch:', err);
      setError(`Failed to create batch: ${errorMessage}`);
      toast.error(`Failed to create batch: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update jobs with batch ID
   */
  const updateJobsWithBatchId = async (
    tableName: TableName,
    jobIds: string[],
    batchId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isExistingTable(tableName)) {
        setError(`Table ${tableName} does not exist`);
        return false;
      }

      const updateData = prepareUpdateParams({
        batch_id: castToUUID(batchId),
        status: 'batched'
      });

      // Convert job IDs to UUID format
      const safeJobIds = jobIds.map(id => castToUUID(id));

      const { error: updateError } = await supabase
        .from(tableName as any)
        .update(updateData)
        .in('id', safeJobIds as any);
        
      if (updateError) {
        console.error('Error updating jobs with batch ID:', updateError);
        setError(`Failed to update jobs: ${updateError.message}`);
        toast.error('Failed to update jobs with batch ID');
        return false;
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in updateJobsWithBatchId:', err);
      setError(`Failed to update jobs: ${errorMessage}`);
      toast.error(`Failed to update jobs: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    fetchBatchById,
    fetchJobsByBatchId,
    createBatch,
    updateJobsWithBatchId
  };
}
