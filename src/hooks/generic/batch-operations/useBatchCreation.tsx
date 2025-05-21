
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
import { isExistingTable } from "@/utils/database/tableUtils";

// Define interface for linked job result
interface LinkedJobResult {
  id: string;
  batch_id: string | null;
}

// Define shape of database item to help with type safety
interface JobDatabaseItem {
  id: string | number;
  batch_id?: string | number | null;
  [key: string]: any; // Allow other properties
}

// Helper function to determine if an object is a valid job database item
function isValidJobItem(item: unknown): item is JobDatabaseItem {
  if (!item || typeof item !== 'object') return false;
  
  // Check if item has an id property
  return 'id' in item && item.id !== undefined && item.id !== null;
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
      console.log("Selected job IDs:", selectedJobs.map(job => job.id).join(", "));
      
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
      const validatedTableName = tableName as ExistingTableName;
      
      // Update the jobs with the batch ID
      const { error: updateError } = await supabase
        .from(validatedTableName)
        .update({
          status: "batched",
          batch_id: batch.id
        })
        .in("id", jobIds);
      
      if (updateError) {
        console.error("Error updating jobs with batch ID:", updateError);
        console.error("Error details:", updateError.details || updateError.hint || updateError.message);
        
        // Try to delete the batch since jobs update failed
        await supabase.from("batches").delete().eq("id", batch.id);
        throw new Error(`Failed to link jobs to batch: ${updateError.message}`);
      }
      
      // Verify jobs were correctly updated with batch ID
      const { data: updatedJobsData, error: verifyError } = await supabase
        .from(validatedTableName)
        .select("id, batch_id")
        .in("id", jobIds);
      
      if (verifyError) {
        console.error("Error verifying job updates:", verifyError);
      } else {
        // Safely transform data to typed array with guaranteed non-null objects
        const updatedJobs: LinkedJobResult[] = [];
        
        if (updatedJobsData && Array.isArray(updatedJobsData)) {
          // Type guard: First ensure updatedJobsData is an array
          updatedJobsData.forEach((rawItem) => {
            // Skip null or error items entirely
            if (rawItem === null) {
              return;
            }
            
            // Use our helper function to verify this is a valid job item
            if (isValidJobItem(rawItem)) {
              // Convert id to string (handles both string and number types)
              const id = String(rawItem.id);
              
              // Handle batch_id which might be undefined or null
              let batchId: string | null = null;
              if ('batch_id' in rawItem && rawItem.batch_id !== undefined && rawItem.batch_id !== null) {
                batchId = String(rawItem.batch_id);
              }
              
              // Now we can safely push to our result array
              updatedJobs.push({
                id: id,
                batch_id: batchId
              });
            }
          });
          
          // Now we have a safely typed array with known structure
          const unlinkedJobs = updatedJobs.filter(job => {
            // Make sure job exists and has proper batch_id before comparison
            return job && job.batch_id !== batch.id;
          });
          
          if (unlinkedJobs.length > 0) {
            console.warn(`Warning: ${unlinkedJobs.length} jobs not correctly linked to batch`);
            console.log("Unlinked jobs:", unlinkedJobs);
            
            // Try to relink each unlinked job individually
            for (const unlinkedJob of unlinkedJobs) {
              // Fix: Only try to relink if unlinkedJob is defined and has an id
              if (unlinkedJob && typeof unlinkedJob === 'object' && 'id' in unlinkedJob && unlinkedJob.id) {
                try {
                  const { error: retryError } = await supabase
                    .from(validatedTableName)
                    .update({
                      status: "batched",
                      batch_id: batch.id
                    })
                    .eq("id", unlinkedJob.id);
                  
                  if (retryError) {
                    console.error(`Failed to relink job ${unlinkedJob.id}:`, retryError);
                  } else {
                    console.log(`Successfully relinked job ${unlinkedJob.id}`);
                  }
                } catch (retryError) {
                  console.error(`Exception when trying to relink job:`, retryError);
                }
              }
            }
            
            // Fix: Filter out null jobs and ensure we never work with null values
            const jobIds = unlinkedJobs
              .filter((job): job is LinkedJobResult => {
                // Type guard function that ensures job is a valid LinkedJobResult
                return job !== null && 
                       job !== undefined && 
                       typeof job === 'object' && 
                       'id' in job && 
                       typeof job.id === 'string';
              })
              .map(job => job.id); // Now TypeScript knows job.id exists and is a string
              
            if (jobIds.length > 0) {
              const { data: finalCheck, error: finalCheckError } = await supabase
                .from(validatedTableName)
                .select("id, batch_id")
                .in("id", jobIds);
                
              if (finalCheckError) {
                console.error("Error performing final check of batch association:", finalCheckError);
              } else if (finalCheck) {
                // Fix: Use a stronger type guard approach with definitive null checks
                let stillUnlinked = 0;
                
                if (Array.isArray(finalCheck)) {
                  // Create a safe array of items we know match our expected structure
                  const safeItems: { id: string, batch_id: string | null }[] = [];
                  
                  // First filter for valid items and transform to a known structure
                  for (const item of finalCheck) {
                    // Guard against null first
                    if (item === null || item === undefined) {
                      continue;
                    }
                    
                    // Now that we know item is not null, check its structure
                    if (typeof item === 'object' && !('error' in item)) {
                      // Check for necessary properties before accessing them
                      if ('id' in item && item.id !== null) {
                        const id = String(item.id);
                        let batchId: string | null = null;
                        
                        // Extra safety check for batch_id property
                        if ('batch_id' in item && item.batch_id !== undefined && item.batch_id !== null) {
                          batchId = String(item.batch_id);
                        }
                        
                        // Only add valid items with non-empty IDs
                        if (id !== "") {
                          safeItems.push({
                            id: id,
                            batch_id: batchId
                          });
                        }
                      }
                    }
                  }
                  
                  // Now safely count items that don't match the batch
                  stillUnlinked = safeItems.filter(item => item.batch_id !== batch.id).length;
                }
                
                if (stillUnlinked > 0) {
                  toast.warning(`${stillUnlinked} jobs could not be linked to the batch`, {
                    description: "Some jobs may need to be manually added to the batch"
                  });
                }
              }
            }
          } else {
            console.log(`All ${updatedJobs.length} jobs successfully linked to batch ${batch.id}`);
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
