
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableValidation";

/**
 * Hook for handling job database operations
 */
export const useJobDatabase = () => {
  /**
   * Validates that all required fields match the schema
   */
  const validateJobFields = async (
    tableName: string, 
    jobData: Record<string, any>
  ): Promise<{ valid: boolean; missingFields?: string[]; invalidFields?: string[] }> => {
    try {
      // Basic required field validation
      const requiredFields = ['name', 'quantity', 'due_date', 'pdf_url'];
      const missingFields = requiredFields.filter(field => !jobData[field]);
      
      if (missingFields.length > 0) {
        console.error("Missing required job data fields:", missingFields);
        return { valid: false, missingFields };
      }

      // Validate schema by checking if all fields exist in the table
      const { data: columns, error: schemaError } = await supabase
        .from(tableName as any)
        .select()
        .limit(1);

      if (schemaError) {
        console.error("Error checking schema:", schemaError);
        return { valid: false };
      }
      
      // Get column names from a direct database query instead of using RPC
      const { data: tableColumns, error: tableInfoError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', tableName)
        .eq('table_schema', 'public');
      
      if (tableInfoError) {
        console.error("Error fetching table info:", tableInfoError);
        return { valid: false };
      }
      
      // Extract column names from the result
      const allowedColumns = tableColumns?.map((col: any) => col.column_name) || [];
      
      // Check if any field doesn't exist in the table schema
      const jobDataKeys = Object.keys(jobData);
      const invalidFields = jobDataKeys.filter(key => 
        key !== 'id' && // Skip id field as it might be auto-generated
        !allowedColumns.includes(key)
      );
      
      if (invalidFields.length > 0) {
        console.error("Invalid fields detected:", invalidFields);
        console.error("Allowed columns are:", allowedColumns);
        return { valid: false, invalidFields };
      }
      
      return { valid: true };
    } catch (error) {
      console.error("Error validating job fields:", error);
      return { valid: false };
    }
  };

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
        
        // Provide more specific error messages based on error codes
        if (error.code === '42703') { // undefined_column
          toast.error(`Database schema error: One or more fields don't exist in the database`);
          
          // Try to identify which column is causing the issue
          const match = error.message.match(/column "([^"]+)" of relation/);
          if (match && match[1]) {
            const problematicColumn = match[1];
            console.error(`Problem with column: ${problematicColumn}`);
            toast.error(`Field "${problematicColumn}" is not defined in the database schema`);
          }
        } else if (error.code === '23502') { // not_null_violation
          toast.error(`Required field missing: ${error.message}`);
        } else {
          toast.error(`Failed to create job: ${error.message}`);
        }
        
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
        
        // Provide more specific error messages based on error codes
        if (error.code === '42703') { // undefined_column
          toast.error(`Database schema error: One or more fields don't exist in the database`);
          
          // Try to identify which column is causing the issue
          const match = error.message.match(/column "([^"]+)" of relation/);
          if (match && match[1]) {
            const problematicColumn = match[1];
            console.error(`Problem with column: ${problematicColumn}`);
            toast.error(`Field "${problematicColumn}" is not defined in the database schema`);
          }
        } else {
          toast.error(`Failed to update job: ${error.message}`);
        }
        
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
    updateJob,
    validateJobFields
  };
};
