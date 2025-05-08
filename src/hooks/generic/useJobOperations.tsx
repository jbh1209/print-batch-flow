
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BaseJob, JobStatus, TableName } from '@/config/productTypes';
import { isExistingTable } from '@/utils/database/tableValidation';
import { castToUUID, prepareUpdateParams } from '@/utils/database/dbHelpers';

export function useJobOperations(tableName: TableName | undefined, userId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteJob = async (jobId: string) => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot delete job`);
      }
      
      // Use castToUUID to safely cast parameters
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', castToUUID(jobId))
        .eq('user_id', castToUUID(userId));

      if (error) throw error;
      
      toast.success("Job deleted successfully");
      return true;
    } catch (err) {
      console.error(`Error deleting job:`, err);
      toast.error("Error deleting job");
      throw err;
    }
  };

  const createJob = async <T extends BaseJob>(
    jobData: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>,
    userId: string
  ) => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot create job`);
      }
      
      // Create the base job object
      const newJobBase = {
        ...jobData,
        user_id: userId,
        status: 'queued' as JobStatus
      };
      
      // Use prepareUpdateParams for type safety
      const newJob = prepareUpdateParams(newJobBase);

      // Use proper typing with table name
      const { data, error } = await supabase
        .from(tableName as any)
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;
      
      // Use explicit type casting to avoid excessive type instantiation
      return data as unknown as T;
    } catch (err) {
      console.error(`Error creating job:`, err);
      throw err;
    }
  };

  const updateJob = async <T extends BaseJob>(
    jobId: string,
    jobData: Partial<T>,
    userId: string
  ) => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot update job`);
      }
      
      // Use prepareUpdateParams for type safety
      const preparedData = prepareUpdateParams(jobData);
      
      // Use castToUUID to safely cast parameters
      const { data, error } = await supabase
        .from(tableName as any)
        .update(preparedData)
        .eq('id', castToUUID(jobId))
        .eq('user_id', castToUUID(userId))
        .select()
        .single();

      if (error) throw error;
      
      // Use explicit type casting to avoid excessive type instantiation
      return data as unknown as T;
    } catch (err) {
      console.error(`Error updating job:`, err);
      throw err;
    }
  };

  const getJobById = async <T extends BaseJob>(jobId: string, userId: string) => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot get job`);
      }
      
      // Use castToUUID to safely cast parameters
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .eq('id', castToUUID(jobId))
        .eq('user_id', castToUUID(userId))
        .single();

      if (error) throw error;
      
      // Use explicit type casting to avoid excessive type instantiation
      return data as unknown as T;
    } catch (err) {
      console.error(`Error getting job:`, err);
      throw err;
    }
  };

  return {
    deleteJob,
    createJob,
    updateJob,
    getJobById,
    isLoading,
    error
  };
}
