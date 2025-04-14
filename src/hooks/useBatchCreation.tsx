
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Job, LaminationType } from "@/components/business-cards/JobsTable";
import { generateAndUploadBatchPDFs } from "@/utils/batchPdfOperations";

const PRODUCT_TYPE_CODES = {
  business_cards: "BC",
  flyers: "FLY",
  postcards: "PC",
  boxes: "PB",
  stickers: "ZUND",
  covers: "COV",
  posters: "POST"
};

export function useBatchCreation() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const generateBatchNumber = async (productType: keyof typeof PRODUCT_TYPE_CODES): Promise<string> => {
    // Get the code for the product type
    const typeCode = PRODUCT_TYPE_CODES[productType] || "BC";
    
    // Count existing batches to generate the next number
    const { count, error } = await supabase
      .from("batches")
      .select("*", { count: "exact", head: true })
      .ilike("name", `DXB-${typeCode}-%`);
    
    if (error) {
      console.error("Error counting batches:", error);
    }
    
    // Generate batch number with padding
    const nextNumber = (count ? count + 1 : 1).toString().padStart(5, '0');
    return `DXB-${typeCode}-${nextNumber}`;
  };

  const createBatch = async (selectedJobs: Job[], customBatchName?: string) => {
    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to create batches",
        variant: "destructive",
      });
      return false;
    }

    if (selectedJobs.length === 0) {
      toast({
        title: "No jobs selected",
        description: "Please select at least one job to batch",
        variant: "destructive",
      });
      return false;
    }

    setIsCreatingBatch(true);
    try {
      // Group jobs by lamination type for consistency
      const laminationType = selectedJobs[0].lamination_type;
      
      // Calculate total sheets required based on job quantities
      // 24 cards per sheet (3x8 layout)
      const totalCards = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
      const sheetsRequired = Math.ceil(totalCards / 24);
      
      // Always generate batch name with standardized format
      const name = await generateBatchNumber("business_cards");
      
      // Get earliest due date from jobs for the batch due date
      const earliestDueDate = selectedJobs.reduce((earliest, job) => {
        const jobDate = new Date(job.due_date);
        return jobDate < earliest ? jobDate : earliest;
      }, new Date(selectedJobs[0].due_date));
      
      // Generate and upload PDFs - now using the separated utility function
      const { overviewUrl, impositionUrl } = await generateAndUploadBatchPDFs(
        selectedJobs,
        name,
        user.id
      );
      
      // Insert batch record into database
      const { error: batchError, data: batchData } = await supabase
        .from("batches")
        .insert({
          name,
          lamination_type: laminationType,
          sheets_required: sheetsRequired,
          due_date: earliestDueDate.toISOString(),
          created_by: user.id,
          front_pdf_url: impositionUrl,
          back_pdf_url: overviewUrl
        })
        .select()
        .single();
        
      if (batchError) {
        throw new Error(`Failed to create batch record: ${batchError.message}`);
      }
      
      // Update all selected jobs to link them to the batch and change status
      const batchId = batchData.id;
      const updatePromises = selectedJobs.map(job => 
        supabase
          .from("business_card_jobs")
          .update({ 
            batch_id: batchId,
            status: "batched"
          })
          .eq("id", job.id)
      );
      
      await Promise.all(updatePromises);
      
      sonnerToast.success("Batch created successfully", {
        description: `Created batch ${name} with ${selectedJobs.length} jobs`
      });
      
      return true;
    } catch (error) {
      console.error("Error creating batch:", error);
      toast({
        title: "Error creating batch",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    createBatch,
    isCreatingBatch,
    generateBatchNumber
  };
}
