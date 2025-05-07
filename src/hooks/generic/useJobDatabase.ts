
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
      
      // Validate job data has required fields
      if (!jobData.name || !jobData.quantity || !jobData.due_date || !jobData.pdf_url) {
        console.error("Missing required job data fields:", { 
          name: !!jobData.name,
          quantity: !!jobData.quantity,
          due_date: !!jobData.due_date,
          pdf_url: !!jobData.pdf_url
        });
        toast.error("Missing required job information");
        return false;
      }
      
      console.log("Creating new job in table:", tableName);
      console.log("With job data:", JSON.stringify(jobData, null, 2));
      
      // Use 'as any' to bypass TypeScript's type checking for the table name
      const { data, error } = await supabase
        .from(tableName as any)
        .insert(jobData)
        .select();

      if (error) {
        console.error(`Database error creating job:`, error);
        toast.error(`Failed to create job: ${error.message}`);
        throw error;
      }
      
      console.log("Job created successfully:", data);
      return true;
    } catch (error) {
      console.error(`Error creating job:`, error);
      toast.error(`Failed to create job: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
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
      
      console.log("Updating job in table:", tableName);
      console.log("Job ID:", jobId);
      console.log("With update data:", JSON.stringify(updateData, null, 2));
      
      // Use 'as any' to bypass TypeScript's type checking for the table name
      const { data, error } = await supabase
        .from(tableName as any)
        .update(updateData)
        .eq('id', jobId)
        .select();
        
      if (error) {
        console.error(`Database error updating job:`, error);
        toast.error(`Failed to update job: ${error.message}`);
        throw error;
      }
      
      console.log("Job updated successfully:", data);
      return true;
    } catch (error) {
      console.error(`Error updating job:`, error);
      toast.error(`Failed to update job: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  };

  return {
    createJob,
    updateJob
  };
};
