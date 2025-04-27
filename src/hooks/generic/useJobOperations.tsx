
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BaseJob, JobStatus, TableName } from '@/config/productTypes';
import { isExistingTable, getSupabaseTable } from '@/utils/database/tableUtils';

export function useJobOperations(tableName: TableName | undefined, userId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteJob = async (jobId: string): Promise<boolean> => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot delete job`);
      }
      
      // Get the valid table name
      const table = getSupabaseTable(tableName);
      
      // Use explicit response structure to avoid complex typing
      const result = await supabase
        .from(table)
        .delete()
        .eq('id', jobId)
        .eq('user_id', userId);

      if (result.error) throw result.error;
      
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
  ): Promise<T> => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot create job`);
      }
      
      // Get the valid table name
      const table = getSupabaseTable(tableName);
      
      // Create a new job object with required fields
      const newJob = {
        ...jobData,
        user_id: userId,
        status: 'queued' as JobStatus
      };

      // Use explicit response structure to avoid complex typing
      const result = await supabase
        .from(table)
        .insert(newJob)
        .select();

      if (result.error) throw result.error;
      
      if (!result.data || result.data.length === 0) {
        throw new Error('No data returned from insert operation');
      }
      
      // Two-step cast to avoid type instantiation issues
      return result.data[0] as unknown as T;
    } catch (err) {
      console.error(`Error creating job:`, err);
      throw err;
    }
  };

  const updateJob = async <T extends BaseJob>(
    jobId: string,
    jobData: Partial<T>,
    userId: string
  ): Promise<T> => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot update job`);
      }
      
      // Get the valid table name
      const table = getSupabaseTable(tableName);
      
      // Use explicit response structure to avoid complex typing
      const result = await supabase
        .from(table)
        .update(jobData)
        .eq('id', jobId)
        .eq('user_id', userId)
        .select();

      if (result.error) throw result.error;
      
      if (!result.data || result.data.length === 0) {
        throw new Error('No data returned from update operation');
      }
      
      // Two-step cast to avoid type instantiation issues
      return result.data[0] as unknown as T;
    } catch (err) {
      console.error(`Error updating job:`, err);
      throw err;
    }
  };

  const getJobById = async <T extends BaseJob>(jobId: string, userId: string): Promise<T | null> => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot get job`);
      }
      
      // Get the valid table name
      const table = getSupabaseTable(tableName);
      
      // Use explicit response structure to avoid complex typing
      const result = await supabase
        .from(table)
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .limit(1);

      if (result.error) throw result.error;
      
      if (!result.data || result.data.length === 0) {
        return null;
      }
      
      // Two-step cast to avoid type instantiation issues
      return result.data[0] as unknown as T;
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
