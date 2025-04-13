
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Job, LaminationType } from "@/components/business-cards/JobsTable";
import { generateBatchOverview } from "@/utils/batchGeneration";
import { generateImpositionSheet } from "@/utils/batchImposition";

export function useBatchCreation() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const createBatch = async (selectedJobs: Job[], batchName?: string) => {
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
      
      // Generate default batch name if not provided
      const defaultBatchName = `Batch-${new Date().toISOString().split('T')[0]}-${laminationType}`;
      const name = batchName || defaultBatchName;
      
      // Get earliest due date from jobs for the batch due date
      const earliestDueDate = selectedJobs.reduce((earliest, job) => {
        const jobDate = new Date(job.due_date);
        return jobDate < earliest ? jobDate : earliest;
      }, new Date(selectedJobs[0].due_date));
      
      // Create batch overview A4 PDF
      const batchOverviewPDF = await generateBatchOverview(selectedJobs, name);
      
      // Generate imposition sheet (320x455mm)
      const impositionSheetPDF = await generateImpositionSheet(selectedJobs);
      
      // Upload both PDFs to storage
      const overviewFilePath = `batches/${user.id}/${Date.now()}-overview-${name}.pdf`;
      const impositionFilePath = `batches/${user.id}/${Date.now()}-imposition-${name}.pdf`;
      
      // Upload batch overview
      const { error: overviewError, data: overviewData } = await supabase.storage
        .from("pdf_files")
        .upload(overviewFilePath, batchOverviewPDF);
        
      if (overviewError) {
        throw new Error(`Failed to upload batch overview: ${overviewError.message}`);
      }
      
      // Get URL for batch overview
      const { data: overviewUrlData } = supabase.storage
        .from("pdf_files")
        .getPublicUrl(overviewFilePath);
        
      if (!overviewUrlData?.publicUrl) {
        throw new Error("Failed to get public URL for batch overview");
      }
      
      // Upload imposition sheet
      const { error: impositionError } = await supabase.storage
        .from("pdf_files")
        .upload(impositionFilePath, impositionSheetPDF);
        
      if (impositionError) {
        throw new Error(`Failed to upload imposition sheet: ${impositionError.message}`);
      }
      
      // Get URL for imposition sheet
      const { data: impositionUrlData } = supabase.storage
        .from("pdf_files")
        .getPublicUrl(impositionFilePath);
        
      if (!impositionUrlData?.publicUrl) {
        throw new Error("Failed to get public URL for imposition sheet");
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
          front_pdf_url: impositionUrlData.publicUrl,
          back_pdf_url: overviewUrlData.publicUrl
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
    isCreatingBatch
  };
}
