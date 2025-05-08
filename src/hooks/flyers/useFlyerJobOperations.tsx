
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Job, LaminationType } from "@/components/business-cards/JobsTable";
import { generateAndUploadBatchPDFs } from "@/utils/batchPdfOperations";
import { 
  createUpdateData,
  createInsertData,
  safeDbMap, 
  toSafeString,
  castToUUID,
  safeGetId
} from "@/utils/database/dbHelpers";

// Standardized product type codes for batch naming
const PRODUCT_TYPE_CODES = {
  "business_cards": "BC",
  "flyers": "FL",
  "postcards": "PC",
  "boxes": "PB", 
  "stickers": "STK",
  "covers": "COV",
  "posters": "POS",
  "sleeves": "SL"
};

export function useBatchCreation() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const generateBatchNumber = async (productType: keyof typeof PRODUCT_TYPE_CODES): Promise<string> => {
    // Get the code for the product type
    const typeCode = PRODUCT_TYPE_CODES[productType] || "BC";
    
    try {
      // Count existing batches with this prefix to determine next number
      const { data, error } = await supabase
        .from("batches")
        .select("name")
        .ilike(`name`, `DXB-${typeCode}-%`);
      
      if (error) {
        console.error("Error getting batch names:", error);
        throw error;
      }
      
      // Default to 1 if no batches found
      let nextNumber = 1;
      
      if (data && data.length > 0) {
        // Extract numbers from existing batch names safely
        const batchNames = safeDbMap(data, batch => toSafeString(batch.name));
        
        // Extract numeric portions of batch names
        const numbers = batchNames.map(name => {
          const match = name.match(/DXB-[A-Z]+-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        
        // Find the highest number and increment
        nextNumber = Math.max(0, ...numbers) + 1;
      }
      
      // Format with 5 digits padding
      const formattedNumber = nextNumber.toString().padStart(5, '0');
      return `DXB-${typeCode}-${formattedNumber}`;
    } catch (err) {
      console.error("Error generating batch number:", err);
      // Fallback to timestamp-based name
      return `DXB-${typeCode}-${Date.now().toString().substr(-5)}`;
    }
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
      
      // Generate batch name with standardized format
      const name = customBatchName || await generateBatchNumber("business_cards");
      
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
      
      // Create batch data object for insertion using our enhanced helper
      const batchInsertData = createInsertData({
        name,
        lamination_type: laminationType,
        sheets_required: sheetsRequired,
        due_date: earliestDueDate.toISOString(),
        created_by: user.id,
        front_pdf_url: impositionUrl,
        back_pdf_url: overviewUrl
      });
      
      // Insert batch record into database
      const { data: createdBatch, error: batchError } = await supabase
        .from("batches")
        .insert(batchInsertData)
        .select()
        .single();
        
      if (batchError) {
        throw new Error(`Failed to create batch record: ${batchError.message}`);
      }
      
      // Safely extract batch ID
      const batchId = safeGetId(createdBatch);
      
      if (!batchId) {
        throw new Error("Failed to get batch ID from created batch");
      }
      
      // Update all selected jobs to link them to the batch and change status
      const updatePromises = selectedJobs.map(job => 
        supabase
          .from("business_card_jobs")
          .update(createUpdateData({ 
            batch_id: batchId,
            status: "batched"
          }))
          .eq("id", castToUUID(job.id))
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
