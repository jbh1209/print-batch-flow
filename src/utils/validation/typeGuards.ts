
import { BaseJob, BaseBatch, ProductConfig } from "@/config/productTypes";
import { toast } from "sonner";

/**
 * Type guard for BaseJob interface
 * @param obj The object to check
 * @returns Boolean indicating if the object conforms to BaseJob interface
 */
export function isBaseJob(obj: any): obj is BaseJob {
  if (!obj) return false;
  
  // Check required properties
  const hasRequiredProps = 
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' && 
    typeof obj.status === 'string' &&
    typeof obj.quantity === 'number';
    
  // Due date can be string or Date object
  const hasDueDate = typeof obj.due_date === 'string' || obj.due_date instanceof Date;
  
  return hasRequiredProps && hasDueDate;
}

/**
 * Type guard for BaseBatch interface
 * @param obj The object to check
 * @returns Boolean indicating if the object conforms to BaseBatch interface
 */
export function isBaseBatch(obj: any): obj is BaseBatch {
  if (!obj) return false;
  
  return (
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.sheets_required === 'number' &&
    typeof obj.due_date === 'string' &&
    typeof obj.created_at === 'string'
  );
}

/**
 * Type guard for ProductConfig interface
 * @param obj The object to check
 * @returns Boolean indicating if the object conforms to ProductConfig interface
 */
export function isProductConfig(obj: any): obj is ProductConfig {
  if (!obj) return false;
  
  return (
    typeof obj.productType === 'string' && 
    typeof obj.tableName === 'string' &&
    typeof obj.jobNumberPrefix === 'string' &&
    typeof obj.slaTargetDays === 'number' &&
    obj.routes && 
    typeof obj.routes === 'object' &&
    obj.ui &&
    typeof obj.ui === 'object'
  );
}

/**
 * Asserts that the object is a valid BaseJob, throws otherwise
 */
export function assertBaseJob(obj: any): asserts obj is BaseJob {
  if (!isBaseJob(obj)) {
    const error = new Error(`Invalid job object: ${JSON.stringify(obj)}`);
    console.error(error);
    toast.error("Invalid job data format detected");
    throw error;
  }
}

/**
 * Asserts that the object is a valid BaseBatch, throws otherwise
 */
export function assertBaseBatch(obj: any): asserts obj is BaseBatch {
  if (!isBaseBatch(obj)) {
    const error = new Error(`Invalid batch object: ${JSON.stringify(obj)}`);
    console.error(error);
    toast.error("Invalid batch data format detected");
    throw error;
  }
}

/**
 * Safely converts an unknown object to BaseJob type with validation
 * @param obj The object to convert
 * @returns A valid BaseJob object or null if validation fails
 */
export function toSafeBaseJob(obj: any): BaseJob | null {
  try {
    if (!isBaseJob(obj)) {
      console.warn("Invalid job object:", obj);
      return null;
    }
    
    return obj as BaseJob;
  } catch (error) {
    console.error("Error converting to BaseJob:", error);
    return null;
  }
}

/**
 * Safely converts an unknown object to BaseBatch type with validation
 * @param obj The object to convert
 * @returns A valid BaseBatch object or null if validation fails
 */
export function toSafeBaseBatch(obj: any): BaseBatch | null {
  try {
    if (!isBaseBatch(obj)) {
      console.warn("Invalid batch object:", obj);
      return null;
    }
    
    return obj as BaseBatch;
  } catch (error) {
    console.error("Error converting to BaseBatch:", error);
    return null;
  }
}

/**
 * Ensures that an array of objects conforms to BaseJob interface
 * @param objArray Array of objects to validate
 * @returns Array of validated BaseJob objects with invalid entries filtered out
 */
export function ensureValidJobsArray(objArray: any[]): BaseJob[] {
  if (!Array.isArray(objArray)) {
    console.warn("Not an array:", objArray);
    return [];
  }
  
  return objArray
    .map(obj => toSafeBaseJob(obj))
    .filter((job): job is BaseJob => job !== null);
}

/**
 * Ensures that an array of objects conforms to BaseBatch interface
 * @param objArray Array of objects to validate
 * @returns Array of validated BaseBatch objects with invalid entries filtered out
 */
export function ensureValidBatchesArray(objArray: any[]): BaseBatch[] {
  if (!Array.isArray(objArray)) {
    console.warn("Not an array:", objArray);
    return [];
  }
  
  return objArray
    .map(obj => toSafeBaseBatch(obj))
    .filter((batch): batch is BaseBatch => batch !== null);
}
