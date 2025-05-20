
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

export interface BatchCreationResult {
  success: boolean;
  batchId: string | null;
  error?: string;
  jobsUpdated: number;
}

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  const createBatchWithSelectedJobs = async (
    selectedJobs: BaseJob[],
    config: ProductConfig,
    laminationType: LaminationType = "none",
    slaTargetDays?: number
  ): Promise<BatchCreationResult> => {
    if (!user) {
      toast.error("User must be logged in to create batches");
      return { success: false, batchId: null, error: "Authentication required", jobsUpdated: 0 };
    }

    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch creation");
      return { success: false, batchId: null, error: "No jobs selected", jobsUpdated: 0 };
    }

    // Validate tableName before proceeding
    if (!validateTableConfig(tableName, productType) || !isExistingTable(tableName)) {
      toast.error(`Invalid table configuration: ${tableName}`);
      return { success: false, batchId: null, error: `Invalid table configuration: ${tableName}`, jobsUpdated: 0 };
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
        lamination_type: laminationType,
        paper_type: paperType,
        status: 'pending' as const, 
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
      
      // Extract all job IDs for the batch update
      const jobIds = selectedJobs.map(job => job.id);
      
      console.log(`Updating ${jobIds.length} jobs in table ${tableName} with batch id ${batch.id}`);
      
      // Use a validated table name that we confirmed is an existing table
      const validatedTableName = tableName as ExistingTableName;
      
      // Using a BULK update operation instead of individual updates
      // This improves reliability and reduces the chance of partial updates
      const { error: updateError, data: updateData } = await supabase
        .from(validatedTableName)
        .update({
          status: "batched",
          batch_id: batch.id
        })
        .in("id", jobIds)
        .select('id, batch_id'); // Explicitly select fields to verify the update
      
      if (updateError) {
        console.error("Error updating jobs with batch ID:", updateError);
        
        // Try to roll back by deleting the batch since jobs update failed
        const { error: deleteError } = await supabase
          .from("batches")
          .delete()
          .eq("id", batch.id);
          
        if (deleteError) {
          console.error("Error rolling back batch creation:", deleteError);
        } else {
          console.log("Successfully rolled back batch creation after job update failure");
        }
        
        throw new Error(`Failed to update jobs with batch ID: ${updateError.message}`);
      }
      
      // Verify the update results were successful
      // This provides an explicit count of how many records were updated
      if (!updateData || !Array.isArray(updateData)) {
        console.warn("No update confirmation data returned");
        
        // Perform a verification query to double check the update status
        const { data: verificationData, error: verificationError } = await supabase
          .from(validatedTableName)
          .select('id, batch_id')
          .eq('batch_id', batch.id);
          
        if (verificationError) {
          console.error("Error verifying batch job updates:", verificationError);
          throw new Error(`Failed to verify job updates: ${verificationError.message}`);
        }
        
        // Check if verification found any jobs linked to this batch
        const updatedJobCount = verificationData?.length || 0;
        console.log(`Verification found ${updatedJobCount} jobs linked to batch ${batch.id}`);
        
        if (updatedJobCount === 0) {
          // No jobs found linked to this batch - attempt rollback
          console.error("No jobs were linked to the batch - performing rollback");
          const { error: deleteError } = await supabase
            .from("batches")
            .delete()
            .eq("id", batch.id);
            
          if (deleteError) {
            console.error("Error rolling back batch creation:", deleteError);
          }
          
          throw new Error("Failed to link any jobs to the batch");
        }
        
        // Some jobs were linked - report success but with warning
        toast.success(`Batch created with ${updatedJobCount} of ${selectedJobs.length} jobs`);
        return { 
          success: true, 
          batchId: batch.id, 
          jobsUpdated: updatedJobCount,
          error: updatedJobCount < selectedJobs.length 
            ? `Only ${updatedJobCount} of ${selectedJobs.length} jobs were linked to the batch` 
            : undefined
        };
      }
      
      // Count successfully updated jobs from the update response
      const linkedCount = updateData.length;
      console.log(`Successfully linked ${linkedCount} of ${jobIds.length} jobs to batch ${batch.id}`);
      
      // Check if all jobs were linked to the batch
      if (linkedCount < jobIds.length) {
        toast.warning(`Only ${linkedCount} of ${jobIds.length} jobs were linked to the batch`);
      } else {
        toast.success(`Batch created with all ${selectedJobs.length} jobs`);
      }
      
      return { 
        success: true, 
        batchId: batch.id, 
        jobsUpdated: linkedCount,
        error: linkedCount < selectedJobs.length 
          ? `Only ${linkedCount} of ${selectedJobs.length} jobs were linked to the batch` 
          : undefined
      };
    } catch (error) {
      console.error("Error in batch creation:", error);
      toast.error("Failed to create batch: " + (error instanceof Error ? error.message : "Unknown error"));
      return { 
        success: false, 
        batchId: null, 
        error: error instanceof Error ? error.message : "Unknown error",
        jobsUpdated: 0
      };
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
