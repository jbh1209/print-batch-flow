
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseJob, ProductConfig, LaminationType, ExistingTableName } from "@/config/productTypes";
import { useAuth } from "@/hooks/useAuth";
import { addDays, format, isAfter } from "date-fns";
import { isExistingTable } from "@/utils/database/tableValidation";

// Define standard product type codes for batch naming
const PRODUCT_TYPE_CODES = {
  "Business Cards": "BC",
  "BusinessCards": "BC",
  "Flyers": "FL",
  "Postcards": "PC",
  "Posters": "POS",
  "Sleeves": "SL",
  "Boxes": "PB",
  "Covers": "COV",
  "Stickers": "STK"
};

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  // Generate a batch name with the correct prefix format based on product type
  const generateBatchName = async (productType: string): Promise<string> => {
    // Get the correct code for the product type
    const typeCode = PRODUCT_TYPE_CODES[productType] || "UNK";
    
    try {
      // Check for existing batches with this prefix to determine next number
      const { data, error } = await supabase
        .from("batches")
        .select("name")
        .ilike("name", `DXB-${typeCode}-%`);
      
      if (error) {
        console.error("Error counting batches:", error);
        throw error;
      }
      
      // Default to 1 if no batches found
      let nextNumber = 1;
      
      if (data && data.length > 0) {
        // Extract numbers from existing batch names
        const numbers = data.map(batch => {
          const match = batch.name.match(/DXB-[A-Z]+-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        
        // Find the highest number and increment
        nextNumber = Math.max(0, ...numbers) + 1;
      }
      
      // Format with 5 digits padding
      const formattedNumber = nextNumber.toString().padStart(5, '0');
      const batchName = `DXB-${typeCode}-${formattedNumber}`;
      
      console.log(`Generated batch name: ${batchName} for product type: ${productType}`);
      return batchName;
    } catch (err) {
      console.error("Error generating batch name:", err);
      // Fallback to timestamp-based name if error occurs
      const timestamp = format(new Date(), "yyyyMMddHHmm");
      return `DXB-${typeCode}-${timestamp}`;
    }
  };

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
    if (!tableName || !isExistingTable(tableName)) {
      console.error(`Invalid table name: ${tableName}`);
      toast.error(`Cannot create batch: Invalid table configuration for ${productType}`);
      return null;
    }

    setIsCreatingBatch(true);
    
    try {
      console.log(`Creating batch with ${selectedJobs.length} jobs for product type: ${productType} using table: ${tableName}`);
      console.log("First job:", selectedJobs[0]);
      
      // Calculate sheets required
      const sheetsRequired = selectedJobs.reduce((total, job) => {
        const jobSheets = Math.ceil(job.quantity / 4); // Assuming 4 per sheet
        return total + jobSheets;
      }, 0);
      
      // Find the earliest due date among selected jobs
      let earliestDueDate = new Date();
      let earliestDueDateFound = false;
      
      selectedJobs.forEach(job => {
        const dueDate = new Date(job.due_date);
        
        if (!earliestDueDateFound || isAfter(earliestDueDate, dueDate)) {
          earliestDueDate = dueDate;
          earliestDueDateFound = true;
        }
      });
      
      // Get the correct SLA days for this product type
      const slaTarget = slaTargetDays || config.slaTargetDays || 3;
      
      // Get common properties from jobs for the batch
      const firstJob = selectedJobs[0];
      const paperType = firstJob.paper_type || config.availablePaperTypes?.[0] || "Paper";
      const paperWeight = firstJob.paper_weight || "standard";
      const sides = firstJob.sides || "single"; // Default to single if not specified
      
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
      
      // Create minimal batch data object with only required fields
      const batchData = {
        name: batchName,
        sheets_required: sheetsRequired,
        due_date: earliestDueDate.toISOString(),
        lamination_type: laminationType,
        paper_type: paperType,
        status: "pending" as "pending" | "processing" | "completed" | "cancelled" | "sent_to_print",
        created_by: user.id,
        sla_target_days: slaTarget
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
