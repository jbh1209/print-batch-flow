
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
  // Generate batch overview A4 PDF
  const batchOverviewPDF = await generateBatchOverview(selectedJobs, name);
  
  // Generate imposition sheet (320x455mm)
  const impositionSheetPDF = await generateImpositionSheet(selectedJobs);
  
  // Set file paths for uploads
  const overviewFilePath = `batches/${userId}/${Date.now()}-overview-${name}.pdf`;
  const impositionFilePath = `batches/${userId}/${Date.now()}-imposition-${name}.pdf`;
  
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
  
  return {
    overviewUrl: overviewUrlData.publicUrl,
    impositionUrl: impositionUrlData.publicUrl
  };
}
