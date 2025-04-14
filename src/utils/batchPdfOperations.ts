
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
    
    // Ensure the "pdf_files" bucket exists and is public
    try {
      // First try to get the bucket to check if it exists
      const { error: getBucketError } = await supabase
        .storage
        .getBucket("pdf_files");
      
      if (getBucketError) {
        // If bucket doesn't exist, attempt to create it with public access
        console.log("Attempt to create pdf_files bucket");
        const { error: createBucketError } = await supabase
          .storage
          .createBucket("pdf_files", {
            public: true, // CRITICAL: Make bucket public
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ["application/pdf"]
          });
        
        if (createBucketError) {
          console.error("Error creating bucket:", createBucketError);
          // Don't throw, just continue and try to upload anyway
        } else {
          // If bucket was created, update its permissions to be public
          const { error: updateBucketError } = await supabase
            .storage
            .updateBucket("pdf_files", {
              public: true // Ensure it's public
            });
            
          if (updateBucketError) {
            console.error("Error updating bucket to public:", updateBucketError);
          }
        }
      } else {
        // If bucket exists, make sure it's public
        const { error: updateBucketError } = await supabase
          .storage
          .updateBucket("pdf_files", {
            public: true
          });
          
        if (updateBucketError) {
          console.error("Error updating bucket to public:", updateBucketError);
        }
      }
    } catch (bucketError) {
      console.error("Error checking/creating bucket:", bucketError);
      // Continue anyway as the bucket might already exist
    }
    
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
        cacheControl: "3600",
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
