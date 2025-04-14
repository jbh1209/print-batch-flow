import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/components/business-cards/JobsTable";
import { generateBatchOverview } from "./batchGeneration";
import { generateImpositionSheet } from "./batchImposition";

/**
 * Handles generation and upload of batch PDFs
 */
export async function generateAndUploadBatchPDFs(
  selectedJobs: Job[], 
  name: string, 
  userId: string
): Promise<{
  overviewUrl: string;
  impositionUrl: string;
}> {
  try {
    console.log("Starting PDF generation for batch:", name);
    
    // Generate batch overview A4 PDF
    const batchOverviewPDF = await generateBatchOverview(selectedJobs, name);
    console.log("Successfully generated batch overview PDF");
    
    // Generate imposition sheet (320x455mm) with duplicated pages for front/back printing
    const impositionSheetPDF = await generateImpositionSheet(selectedJobs);
    console.log("Successfully generated imposition sheet PDF");
    
    // Set file paths for uploads with clear naming convention
    // Keep userId as the first folder for RLS policy to work
    const timestamp = Date.now();
    const overviewFilePath = `${userId}/${timestamp}-overview-${name}.pdf`;
    const impositionFilePath = `${userId}/${timestamp}-imposition-${name}.pdf`;
    
    console.log("Uploading batch overview PDF...");
    // Upload batch overview
    const { error: overviewError } = await supabase.storage
      .from("pdf_files")
      .upload(overviewFilePath, batchOverviewPDF);
      
    if (overviewError) {
      console.error("Overview upload error:", overviewError);
      throw new Error(`Failed to upload batch overview: ${overviewError.message}`);
    }
    
    // Get URL for batch overview
    const { data: overviewUrlData } = supabase.storage
      .from("pdf_files")
      .getPublicUrl(overviewFilePath);
      
    if (!overviewUrlData?.publicUrl) {
      throw new Error("Failed to get public URL for batch overview");
    }
    
    console.log("Uploading imposition sheet PDF...");
    // Upload imposition sheet
    const { error: impositionError } = await supabase.storage
      .from("pdf_files")
      .upload(impositionFilePath, impositionSheetPDF);
      
    if (impositionError) {
      console.error("Imposition upload error:", impositionError);
      throw new Error(`Failed to upload imposition sheet: ${impositionError.message}`);
    }
    
    // Get URL for imposition sheet
    const { data: impositionUrlData } = supabase.storage
      .from("pdf_files")
      .getPublicUrl(impositionFilePath);
      
    if (!impositionUrlData?.publicUrl) {
      throw new Error("Failed to get public URL for imposition sheet");
    }
    
    console.log("Successfully uploaded both PDFs");
    return {
      overviewUrl: overviewUrlData.publicUrl,
      impositionUrl: impositionUrlData.publicUrl
    };
  } catch (error) {
    console.error("Error in generateAndUploadBatchPDFs:", error);
    throw error;
  }
}
