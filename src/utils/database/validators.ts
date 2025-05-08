
import { TableName } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";

/**
 * Validate a table exists before attempting database operations
 */
export const validateTableExists = (tableName: TableName | string | undefined): boolean => {
  if (!tableName) {
    toast.error("Missing table name for database operation");
    return false;
  }

  if (!isExistingTable(tableName)) {
    toast.error(`Table "${tableName}" is not yet implemented in the database`);
    return false;
  }

  return true;
};

/**
 * Validate user is logged in before attempting database operations
 */
export const validateUser = (userId: string | undefined): boolean => {
  if (!userId) {
    toast.error("You must be logged in to perform this operation");
    return false;
  }
  
  return true;
};

/**
 * Validate a batch operation has jobs selected
 */
export const validateJobsSelected = (jobs: any[] | undefined): boolean => {
  if (!jobs || jobs.length === 0) {
    toast.error("No jobs selected for operation");
    return false;
  }
  
  return true;
};

/**
 * Compound validation for database operations
 */
export const validateDatabaseOperation = (
  options: {
    tableName?: TableName | string;
    userId?: string;
    jobs?: any[];
  }
): boolean => {
  const { tableName, userId, jobs } = options;
  
  if (tableName && !validateTableExists(tableName)) {
    return false;
  }
  
  if (userId && !validateUser(userId)) {
    return false;
  }
  
  if (jobs && !validateJobsSelected(jobs)) {
    return false;
  }
  
  return true;
};
