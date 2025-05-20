
import { BaseJob, ProductConfig } from "@/config/productTypes";
import { toast } from "sonner";
import { validateTableConfig } from "@/utils/batch/tableValidator";
import { isExistingTable } from "@/utils/database/tableValidation";
import { BatchCreationResult } from "../types/batchCreationTypes";
import { createBatchResult } from "./batchDbOperations";

/**
 * Validates inputs for batch creation
 */
export function validateBatchCreationInputs(
  user: any | null,
  selectedJobs: BaseJob[],
  tableName: string,
  productType: string
): BatchCreationResult | null {
  if (!user) {
    toast.error("User must be logged in to create batches");
    return createBatchResult(false, null, 0, "Authentication required");
  }

  if (selectedJobs.length === 0) {
    toast.error("No jobs selected for batch creation");
    return createBatchResult(false, null, 0, "No jobs selected");
  }

  // Validate tableName before proceeding
  if (!validateTableConfig(tableName, productType) || !isExistingTable(tableName)) {
    toast.error(`Invalid table configuration: ${tableName}`);
    return createBatchResult(false, null, 0, `Invalid table configuration: ${tableName}`);
  }

  // All validations passed
  return null;
}
