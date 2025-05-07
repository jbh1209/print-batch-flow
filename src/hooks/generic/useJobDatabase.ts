
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableValidation";

/**
 * Hook for handling job database operations
 */
export const useJobDatabase = () => {
  /**
   * Creates a new job in the database
   */
  const createJob = async (
    tableName: string,
    jobData: Record<string, any>
  ): Promise<boolean> => {
    try {
      // Check if the table exists in the database before operations
      if (!isExistingTable(tableName)) {
        toast.error(`Table ${tableName} is not yet implemented in the database`);
        return false;
      }
      
      console.log("Creating new job with data:", jobData);
      console.log("Table name:", tableName);
      
      // Use 'as any' to bypass TypeScript's type checking for the table name
      const { error } = await supabase
        .from(tableName as any)
        .insert(jobData);

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error(`Error creating job:`, error);
      throw error;
    }
  };

  /**
   * Updates an existing job in the database
   */
  const updateJob = async (
    tableName: string,
    jobId: string,
    updateData: Record<string, any>
  ): Promise<boolean> => {
    try {
      // Check if the table exists in the database before operations
      if (!isExistingTable(tableName)) {
        toast.error(`Table ${tableName} is not yet implemented in the database`);
        return false;
      }
      
      // Use 'as any' to bypass TypeScript's type checking for the table name
      const { error } = await supabase
        .from(tableName as any)
        .update(updateData)
        .eq('id', jobId);
        
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error(`Error updating job:`, error);
      throw error;
    }
  };

  return {
    createJob,
    updateJob
  };
};
