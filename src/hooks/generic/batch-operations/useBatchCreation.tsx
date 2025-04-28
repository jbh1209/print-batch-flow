
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BaseBatch, BaseJob, LaminationType, ProductConfig } from "@/config/productTypes";
import { generateAndUploadBatchPDFs } from "@/utils/batchPdfOperations";

export function useBatchCreation(
  productType: string,
  tableName: string
) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // Helper function to generate batch number with product type
  const generateBatchNumber = async (): Promise<string> => {
    // Create a code based on product type
    const typeCode = productType.substring(0, 2).toUpperCase();
    
    // Count existing batches with this type prefix
    const { count, error } = await supabase
      .from("batches")
      .select("*", { count: "exact", head: true })
      .ilike("name", `DXB-${typeCode}-%`);
      
    if (error) {
      console.error("Error counting batches:", error);
    }
    
    // Generate next number with padding
    const nextNumber = (count ? count + 1 : 1).toString().padStart(5, '0');
    return `DXB-${typeCode}-${nextNumber}`;
  };
  
  // Create a batch with selected jobs
  const createBatchWithSelectedJobs = async (
    selectedJobs: BaseJob[],
    config: ProductConfig,
    laminationType: LaminationType = "none",
    customSlaTargetDays?: number
  ): Promise<BaseBatch | null> => {
    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to create batches",
        variant: "destructive",
      });
      return null;
    }
    
    if (selectedJobs.length === 0) {
      toast({
        title: "No jobs selected",
        description: "Please select at least one job to batch",
        variant: "destructive",
      });
      return null;
    }

    setIsCreatingBatch(true);
    
    try {
      // Generate batch name
      const batchName = await generateBatchNumber();
      
      // Get earliest due date from selected jobs
      const earliestDueDate = selectedJobs.reduce((earliest, job) => {
        const jobDate = new Date(job.due_date);
        return jobDate < earliest ? jobDate : earliest;
      }, new Date(selectedJobs[0].due_date));
      
      // Calculate total sheets required
      const totalCards = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
      const sheetsRequired = Math.ceil(totalCards / 24); // 24 cards per sheet (3x8 layout)
      
      // Use custom SLA target days if provided, otherwise use the product config
      const slaTargetDays = customSlaTargetDays !== undefined 
        ? customSlaTargetDays 
        : config.slaTargetDays;
        
      // Generate and upload batch PDFs
      const { overviewUrl, impositionUrl } = await generateAndUploadBatchPDFs(
        selectedJobs,
        batchName,
        user.id
      );
      
      // Create batch record
      const { data: batchData, error: batchError } = await supabase
        .from("batches")
        .insert({
          name: batchName,
          lamination_type: laminationType,
          sheets_required: sheetsRequired,
          due_date: earliestDueDate.toISOString(),
          created_by: user.id,
          front_pdf_url: impositionUrl,
          back_pdf_url: overviewUrl,
          sla_target_days: slaTargetDays // Store the SLA target days in the batch
        })
        .select()
        .single();
        
      if (batchError) {
        throw new Error(`Failed to create batch: ${batchError.message}`);
      }
      
      // Update all selected jobs to attach them to the batch
      const batchId = batchData.id;
      
      // Update jobs - using a more type-safe approach
      for (const job of selectedJobs) {
        // Use the specific table for each job
        await supabase
          .from(tableName as any) // Use type assertion here to fix TS error
          .update({
            batch_id: batchId,
            status: "batched"
          })
          .eq("id", job.id);
      }
      
      // Add the virtual property needed by UI
      const resultBatch: BaseBatch = {
        ...batchData,
        overview_pdf_url: overviewUrl // Add this property to match BaseBatch type
      };
      
      sonnerToast.success(`Batch ${batchName} created successfully`, {
        description: `Created with ${selectedJobs.length} jobs, SLA: ${slaTargetDays} days`
      });
      
      return resultBatch;
      
    } catch (error) {
      console.error("Error creating batch:", error);
      toast({
        title: "Failed to create batch",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    createBatchWithSelectedJobs,
    isCreatingBatch,
    generateBatchNumber
  };
}
