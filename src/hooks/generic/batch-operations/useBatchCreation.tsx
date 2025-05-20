
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
import { isExistingTable } from "@/utils/database/tableValidation";

// Define interface for linked job result
interface LinkedJobResult {
  id: string;
  batch_id: string | null;
}

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

    // Verify the table exists in our database before proceeding
    if (!isExistingTable(tableName)) {
      toast.error(`Invalid table name: ${tableName}`);
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
      
      // Create batch data object
      const batchData = createBatchDataObject(
        batchName,
        sheetsRequired,
        earliestDueDate,
        laminationType,
        paperType,
        user.id,
        slaTarget
      );
      
      // Create the batch record
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .insert(batchData)
        .select()
        .single();
        
      if (batchError) {
        console.error("Error creating batch:", batchError);
        throw batchError;
      }
      
      if (!batch) {
        throw new Error("Failed to create batch, returned data is empty");
      }
      
      console.log("Batch created successfully:", batch);
      
      // Update all selected jobs to link them to this batch
      const jobIds = selectedJobs.map(job => job.id);
      
      console.log(`Updating ${jobIds.length} jobs in table ${tableName} with batch id ${batch.id}`);
      
      // Use a validated table name that we confirmed is an existing table
      const validatedTableName = tableName;
      
      // Update the jobs with the batch ID
      const { error: updateError } = await supabase
        .from(validatedTableName as any)
        .update({
          status: "batched",
          batch_id: batch.id
        })
        .in("id", jobIds);
      
      if (updateError) {
        console.error("Error updating jobs with batch ID:", updateError);
        // Try to delete the batch since jobs update failed
        await supabase.from("batches").delete().eq("id", batch.id);
        throw updateError;
      }
      
      // Verify jobs were correctly updated with batch ID
      const { data: updatedJobsData, error: verifyError } = await supabase
        .from(validatedTableName as any)
        .select("id, batch_id")
        .in("id", jobIds);
      
      if (verifyError) {
        console.error("Error verifying job updates:", verifyError);
      } else {
        // Safely transform data to typed array with guaranteed non-null objects
        const updatedJobs: LinkedJobResult[] = [];
        
        if (updatedJobsData && Array.isArray(updatedJobsData)) {
          updatedJobsData.forEach((item) => {
            // Ensure item is not null and has the expected properties
            if (item !== null && typeof item === 'object') {
              // Explicitly check if id exists as a property
              if ('id' in item && item.id !== undefined) {
                // Safe to access properties
                const id = String(item.id);
                // Use optional chaining for batch_id to handle undefined case
                const batchId = item.batch_id !== undefined ? String(item.batch_id) : null;
                
                updatedJobs.push({
                  id: id,
                  batch_id: batchId
                });
              }
            }
          });
          
          // Now we have a safely typed array with known structure
          const unlinkedJobs = updatedJobs.filter(job => job.batch_id !== batch.id);
          
          if (unlinkedJobs.length > 0) {
            console.warn(`Warning: ${unlinkedJobs.length} jobs not correctly linked to batch`);
          }
        }
      }
      
      toast.success(`Batch created with ${selectedJobs.length} jobs`);
      return batch;
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
