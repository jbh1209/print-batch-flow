
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Job, LaminationType } from "@/components/business-cards/JobsTable";
import { generateAndUploadBatchPDFs } from "@/utils/batchPdfOperations";
import { isExistingTable } from "@/utils/database/tableValidation";

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
      // Determine the correct table name based on product type
      // For business cards, we know the table name is "business_card_jobs"
      const tableName = "business_card_jobs";
      
      // Verify the table exists in our database before proceeding
      if (!isExistingTable(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
      }
      
      console.log(`Creating batch for product with table: ${tableName}`);
      console.log(`Selected jobs for batching:`, selectedJobs.map(job => ({ id: job.id, name: job.name })));
      
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
      
      let overviewUrl = "";
      let impositionUrl = "";
      
      // Generate and upload PDFs - using the separated utility function with improved error handling
      try {
        const pdfUrls = await generateAndUploadBatchPDFs(
          selectedJobs,
          name,
          user.id
        );
        overviewUrl = pdfUrls.overviewUrl;
        impositionUrl = pdfUrls.impositionUrl;
        console.log("Successfully generated PDFs with URLs:", { overviewUrl, impositionUrl });
      } catch (pdfError) {
        console.error("Error generating/uploading PDFs:", pdfError);
        sonnerToast.error("PDF generation failed", {
          description: "Creating batch without PDFs. You can regenerate them later."
        });
        // Continue with batch creation even if PDFs fail
      }
      
      // Insert batch record into database
      const { error: batchError, data: batchData } = await supabase
        .from("batches")
        .insert({
          name,
          lamination_type: laminationType,
          sheets_required: sheetsRequired,
          due_date: earliestDueDate.toISOString(),
          created_by: user.id,
          front_pdf_url: impositionUrl || null,
          back_pdf_url: overviewUrl || null
        })
        .select()
        .single();
        
      if (batchError) {
        throw new Error(`Failed to create batch record: ${batchError.message}`);
      }
      
      if (!batchData) {
        throw new Error(`Failed to create batch: No batch data returned`);
      }
      
      console.log("Batch created successfully:", batchData);
      
      // Get all job IDs for bulk update
      const jobIds = selectedJobs.map(job => job.id);
      console.log(`Updating ${jobIds.length} jobs in table ${tableName} with batch ID ${batchData.id}`);
      
      // Update all selected jobs to link them to the batch
      const { error: updateJobsError } = await supabase
        .from(tableName)
        .update({ 
          batch_id: batchData.id,
          status: "batched"
        })
        .in("id", jobIds);
      
      if (updateJobsError) {
        console.error("Error updating jobs with batch ID:", updateJobsError);
        // Provide more detailed error information
        const errorDetail = updateJobsError.details || updateJobsError.hint || updateJobsError.message;
        console.error(`Update error details: ${errorDetail}`);
        
        // Try to roll back batch creation since job update failed
        const { error: deleteError } = await supabase.from("batches").delete().eq("id", batchData.id);
        if (deleteError) {
          console.error("Failed to rollback batch creation:", deleteError);
        }
        
        throw new Error(`Failed to update jobs with batch ID: ${updateJobsError.message}`);
      }
      
      // Verify jobs were correctly updated with batch ID
      const { data: updatedJobs, error: verifyError } = await supabase
        .from(tableName)
        .select("id, batch_id")
        .in("id", jobIds);
      
      if (verifyError) {
        console.error("Error verifying job updates:", verifyError);
      } else if (updatedJobs) {
        // Type guard: only proceed if updatedJobs is an array
        if (Array.isArray(updatedJobs)) {
          const unlinkedJobs = updatedJobs.filter(job => 
            job && typeof job === 'object' && 'batch_id' in job && job.batch_id !== batchData.id
          );
          
          if (unlinkedJobs.length > 0) {
            console.warn(`Warning: ${unlinkedJobs.length} jobs not correctly linked to batch`);
            console.log("Unlinked jobs:", unlinkedJobs);
            
            // Retry linking jobs one more time
            for (const unlinkedJob of unlinkedJobs) {
              if (unlinkedJob && unlinkedJob.id) {
                const { error: retryError } = await supabase
                  .from(tableName)
                  .update({ 
                    batch_id: batchData.id,
                    status: "batched"
                  })
                  .eq("id", unlinkedJob.id);
                
                if (retryError) {
                  console.error(`Failed to relink job ${unlinkedJob.id}:`, retryError);
                } else {
                  console.log(`Successfully relinked job ${unlinkedJob.id}`);
                }
              }
            }
          } else {
            console.log(`All ${updatedJobs.length} jobs successfully linked to batch ${batchData.id}`);
          }
        }
      }
      
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
