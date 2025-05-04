
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseJob, ProductConfig, LaminationType } from "@/config/productTypes";
import { useAuth } from "@/hooks/useAuth";
import { addDays, format, isAfter } from "date-fns";

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  // Generate a batch name with the correct prefix format based on product type
  const generateBatchName = (productType: string): string => {
    const date = new Date();
    const dateStr = format(date, "yyyyMMddHHmm");
    
    let prefix = "";
    switch(productType) {
      case "Business Cards": prefix = "DXB-BC"; break;
      case "Flyers": prefix = "DXB-FL"; break;
      case "Postcards": prefix = "DXB-PC"; break;
      case "Posters": prefix = "DXB-POST"; break;
      case "Sleeves": prefix = "DXB-SL"; break;
      case "Boxes": prefix = "DXB-PB"; break;
      case "Covers": prefix = "DXB-COV"; break;
      case "Stickers": prefix = "DXB-ZUND"; break;
      default: prefix = "DXB";
    }
    
    return `${prefix}-${dateStr}`;
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

    setIsCreatingBatch(true);
    
    try {
      console.log(`Creating batch with ${selectedJobs.length} jobs`);
      
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
      const paperType = firstJob.paper_type;
      const paperWeight = firstJob.paper_weight;
      const sides = firstJob.sides || "single"; // Default to single if not specified
      
      // Create the batch with compatible types - using literal string for status
      const batchData = {
        name: generateBatchName(config.productType),
        sheets_required: sheetsRequired,
        due_date: earliestDueDate.toISOString(),
        lamination_type: laminationType,
        paper_type: paperType,
        paper_weight: paperWeight,
        sides: sides,
        status: "pending", // Using the string literal that matches the database's expected enum
        created_by: user.id,
        sla_target_days: slaTarget
      };
      
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
      
      console.log("Batch created:", batch);
      
      // Update all selected jobs to link them to this batch
      const jobIds = selectedJobs.map(job => job.id);
      
      const { error: updateError } = await supabase
        .from(tableName as any)
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
