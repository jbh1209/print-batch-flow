
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BaseJob, JobStatus, TableName } from '@/config/productTypes';
import { isExistingTable } from '@/utils/database/tableUtils';

export function useJobOperations(tableName: TableName | undefined, userId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allow any authenticated user to delete any job
  const deleteJob = async (jobId: string) => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot delete job`);
      }
      
      // Remove user_id filter to allow any authenticated user to delete any job
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', jobId);

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
      
      const newJob = {
        ...jobData,
        user_id: userId, // Still associate the creator's ID 
        status: 'queued' as JobStatus
      };

      // Use 'as any' to bypass TypeScript's type checking for the table name
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

  // Allow any authenticated user to update any job
  const updateJob = async <T extends BaseJob>(
    jobId: string,
    jobData: Partial<T>,
    userId?: string // Made userId optional
  ) => {
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot update job`);
      }
      
      // Remove user_id filter to allow any authenticated user to update any job
      const { data, error } = await supabase
        .from(tableName as any)
        .update(jobData)
        .eq('id', jobId)
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

  // Allow any authenticated user to get any job
  const getJobById = async <T extends BaseJob>(jobId: string, userId?: string) => { // Made userId optional
    try {
      if (!tableName) {
        throw new Error(`Invalid table name`);
      }
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot get job`);
      }
      
      // Remove user_id filter to allow any authenticated user to get any job
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .eq('id', jobId)
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
