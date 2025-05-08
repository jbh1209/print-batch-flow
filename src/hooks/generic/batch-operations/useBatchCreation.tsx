
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseJob, ProductConfig, LaminationType, ExistingTableName } from "@/config/productTypes";
import { useAuth } from "@/hooks/useAuth";
import { generateBatchName } from "@/utils/batch/batchNameGenerator";
import { validateTableConfig } from "@/utils/batch/tableValidator";
import { 
  calculateSheetsRequired, 
  findEarliestDueDate, 
  extractCommonJobProperties,
  createBatchDataObject
} from "@/utils/batch/batchDataProcessor";
import { 
  prepareUpdateParams, 
  castToUUID, 
  safeDbMap, 
  toSafeString, 
  safeGetId,
  safeBatchId
} from "@/utils/database/dbHelpers";

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  const createBatchWithSelectedJobs = async (
    selectedJobs: BaseJob[],
    config: ProductConfig,
    laminationType: LaminationType = "none",
    slaTargetDays?: number
  ) => {
    if (!user) {
      toast.error("User must be logged in to create batches");
      return null;
    }

    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch creation");
      return null;
    }

    // Validate tableName before proceeding
    if (!validateTableConfig(tableName, productType)) {
      return null;
    }

    setIsCreatingBatch(true);
    
    try {
      console.log(`Creating batch with ${selectedJobs.length} jobs for product type: ${productType} using table: ${tableName}`);
      console.log("First job:", selectedJobs[0]);
      
      // Calculate sheets required
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      
      // Find the earliest due date among selected jobs
      const earliestDueDate = findEarliestDueDate(selectedJobs);
      
      // Get the correct SLA days for this product type
      const slaTarget = slaTargetDays || config.slaTargetDays || 3;
      
      // Get common properties from jobs for the batch
      const firstJob = selectedJobs[0];
      const { paperType } = extractCommonJobProperties(firstJob, config);
      
      // Generate batch name with standardized format
      const batchName = await generateBatchName(config.productType);
      
      console.log("Creating batch with name:", batchName);
      console.log("Batch data:", {
        paperType,
        laminationType,
        sheetsRequired,
        dueDate: earliestDueDate.toISOString(),
        slaTarget
      });
      
      // Create batch data object with proper typing
      const batchData = {
        name: batchName,
        sheets_required: sheetsRequired,
        due_date: earliestDueDate.toISOString(),
        lamination_type: laminationType,
        paper_type: paperType,
        status: "pending",
        created_by: user.id,
        sla_target_days: slaTarget
      };
      
      // Prepare data for database insertion with type safety
      const preparedBatchData = prepareUpdateParams(batchData);
      
      // Create the batch record
      const { data: createdBatchData, error: batchError } = await supabase
        .from("batches")
        .insert(preparedBatchData)
        .select()
        .single();
        
      if (batchError) {
        console.error("Error creating batch:", batchError);
        throw batchError;
      }
      
      // Extract batch ID safely using the new utility function
      const batchId = safeBatchId(createdBatchData);
      
      if (!batchId) {
        throw new Error("Failed to get batch ID from created batch");
      }
      
      console.log("Batch created successfully with ID:", batchId);
      
      // Update all selected jobs to link them to this batch
      const jobIds = safeDbMap(selectedJobs, job => toSafeString(job.id));
      
      console.log(`Updating ${jobIds.length} jobs in table ${tableName} with batch id ${batchId}`);
      
      // Use a validated table name that we confirmed is an existing table
      const validatedTableName = tableName as ExistingTableName;
      
      // Create properly typed update data
      const updateData = prepareUpdateParams({
        status: "batched",
        batch_id: batchId
      });
      
      // Update the jobs with the batch ID
      const { error: updateError } = await supabase
        .from(validatedTableName)
        .update(updateData)
        .in("id", jobIds as any);
      
      if (updateError) {
        console.error("Error updating jobs with batch ID:", updateError);
        // Try to delete the batch since jobs update failed
        await supabase.from("batches").delete().eq("id", castToUUID(batchId));
        throw updateError;
      }
      
      toast.success(`Batch created with ${selectedJobs.length} jobs`);
      return { ...createdBatchData, id: batchId };
    } catch (error) {
      console.error("Error in batch creation:", error);
      toast.error("Failed to create batch: " + (error instanceof Error ? error.message : "Unknown error"));
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    createBatchWithSelectedJobs,
    isCreatingBatch,
    generateBatchName
  };
}
