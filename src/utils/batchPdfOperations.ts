
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
    // Pass the batch name to ensure it's displayed correctly
    const impositionSheetPDF = await generateImpositionSheet(selectedJobs, name);
    console.log("Successfully generated imposition sheet PDF");
    
    // Force bucket to be created and public
    await ensurePublicBucket("pdf_files");
    
    // Set file paths for uploads with clear naming convention
    // Keep userId as the first folder for RLS policy to work
    const timestamp = Date.now();
    const overviewFilePath = `${userId}/${timestamp}-overview-${name}.pdf`;
    const impositionFilePath = `${userId}/${timestamp}-imposition-${name}.pdf`;
    
    console.log("Uploading batch overview PDF...");
    // Upload batch overview
    const { error: overviewError } = await supabase.storage
      .from("pdf_files")
      .upload(overviewFilePath, batchOverviewPDF, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true
      });
      
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
      .upload(impositionFilePath, impositionSheetPDF, {
        contentType: "application/pdf",
        cacheControl: "no-cache", // Prevent caching issues
        upsert: true
      });
      
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
    console.log("Overview URL:", overviewUrlData.publicUrl);
    console.log("Imposition URL:", impositionUrlData.publicUrl);
    
    return {
      overviewUrl: overviewUrlData.publicUrl,
      impositionUrl: impositionUrlData.publicUrl
    };
  } catch (error) {
    console.error("Error in generateAndUploadBatchPDFs:", error);
    throw error;
  }
}

// Separate function to ensure bucket exists and is public
async function ensurePublicBucket(bucketName: string) {
  try {
    // First check if bucket exists
    const { data: bucketData, error: getBucketError } = await supabase.storage.getBucket(bucketName);
    
    if (getBucketError) {
      console.log(`Bucket '${bucketName}' doesn't exist yet, creating it...`);
      
      // Create the bucket with public access
      const { error: createError } = await supabase.storage.createBucket(bucketName, { 
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (createError) {
        console.error(`Failed to create bucket '${bucketName}':`, createError);
        return false;
      }
      
      console.log(`Successfully created public bucket '${bucketName}'`);
      return true;
    }
    
    // If bucket exists but isn't public, update it
    if (bucketData && !bucketData.public) {
      console.log(`Bucket '${bucketName}' exists but is not public, updating...`);
      
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true
      });
      
      if (updateError) {
        console.error(`Failed to update bucket '${bucketName}' to public:`, updateError);
        return false;
      }
      
      console.log(`Successfully updated bucket '${bucketName}' to be public`);
    } else {
      console.log(`Bucket '${bucketName}' already exists and is public`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error ensuring public bucket '${bucketName}':`, error);
    return false;
  }
}
