import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseJob, ProductConfig, ExistingTableName } from "@/config/productTypes";
import { LaminationType } from "@/config/types/productConfigTypes";
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
import { generateAndUploadBatchPDFs } from "@/utils/batchPdfOperations";
import { checkBucketExists } from "@/utils/pdf/urlUtils";

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
    if (!validateTableConfig(tableName, productType) || !isExistingTable(tableName)) {
      toast.error(`Invalid table configuration: ${tableName}`);
      return null;
    }

    setIsCreatingBatch(true);
    
    try {
      console.log(`Creating batch with ${selectedJobs.length} jobs for product type: ${productType} using table: ${tableName}`);
      console.log("First job:", selectedJobs[0]);
      
      // Check if bucket exists before trying to create it
      // This helps prevent RLS policy violations
      const bucketExists = await checkBucketExists("pdf_files");
      console.log("pdf_files bucket exists:", bucketExists);
      
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
      
      // Generate and upload batch PDFs
      console.log("Generating batch PDFs for selected jobs...");
      let pdfUrls = { overviewUrl: null, impositionUrl: null };
      
      try {
        pdfUrls = await generateAndUploadBatchPDFs(selectedJobs, batchName, user.id);
        console.log("Generated batch PDFs:", pdfUrls);
      } catch (pdfError) {
        console.error("Error generating batch PDFs:", pdfError);
        toast.error("Could not generate batch PDFs, but will continue with batch creation");
        // Continue with batch creation even if PDF generation fails
      }
      
      // Create batch data object with correct status type
      const batchData = {
        name: batchName,
        sheets_required: sheetsRequired,
        due_date: earliestDueDate.toISOString(),
        lamination_type: laminationType, // Now properly typed as LaminationType
        paper_type: paperType,
        status: 'pending' as const, // Use string literal type instead of BatchStatus
        created_by: user.id,
        sla_target_days: slaTarget,
        // Add PDF URLs if they were generated successfully
        front_pdf_url: pdfUrls.impositionUrl || null,
        back_pdf_url: pdfUrls.overviewUrl || null
      };
      
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
        // Try to delete the batch since jobs update failed
        await supabase.from("batches").delete().eq("id", batch.id);
        throw updateError;
      }
      
      // Double check that jobs were updated
      const { data: updatedJobs, error: checkError } = await supabase
        .from(validatedTableName)
        .select("id, batch_id")
        .in("id", jobIds);
        
      if (checkError) {
        console.error("Error checking updated jobs:", checkError);
      } else {
        // Fix TypeScript error with proper type guards
        if (updatedJobs && Array.isArray(updatedJobs)) {
          // Count jobs that were successfully linked to the batch
          let linkedCount = 0;
          
          // Make a safer loop that doesn't try to access properties until we've verified
          // the object structure
          updatedJobs.forEach(job => {
            // Skip null/undefined items with type guard
            if (!job) return;
            
            // Define a local variable with narrowed type to help TypeScript understand
            const safeJob = job as { id: string; batch_id: string };
            
            // Now we can safely check the properties since we know job exists and isn't null
            if (
                typeof safeJob === 'object' && 
                'batch_id' in safeJob && 
                safeJob.batch_id === batch.id
            ) {
              linkedCount++;
            }
          });
          
          console.log(`Successfully linked ${linkedCount} of ${jobIds.length} jobs to batch ${batch.id}`);
        } else {
          console.warn("No updated jobs returned from query or result is not an array");
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
