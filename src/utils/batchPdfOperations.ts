import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/components/business-cards/JobsTable";
import { BaseJob } from "@/config/productTypes";
import { generateBatchOverview } from "./batchGeneration";
import { generateImpositionSheet } from "./batchImposition";
import { checkBucketExists } from "./pdf/urlUtils";

/**
 * Handles generation and upload of batch PDFs
 */
export async function generateAndUploadBatchPDFs(
  selectedJobs: Job[] | BaseJob[], 
  name: string, 
  userId: string
): Promise<{
  overviewUrl: string;
  impositionUrl: string;
}> {
  try {
    console.log("Starting PDF generation for batch:", name);
    console.log("Batch name being used:", name); // Added debug logging for batch name
    
    // Generate batch overview A4 PDF
    const batchOverviewPDF = await generateBatchOverview(selectedJobs, name);
    console.log("Successfully generated batch overview PDF");
    
    // Generate imposition sheet (320x455mm) with duplicated pages for front/back printing
    // Pass the batch name to ensure it's displayed correctly
    const impositionSheetPDF = await generateImpositionSheet(selectedJobs, name);
    console.log("Successfully generated imposition sheet PDF");
    
    // First check for bucket existence and handle appropriately
    const bucketName = "pdf_files";
    const bucketExists = await checkBucketExists(bucketName);
    
    if (!bucketExists) {
      console.log(`Bucket '${bucketName}' doesn't exist, creating it...`);
      try {
        // Create the bucket with public access
        const { error: createError } = await supabase.storage.createBucket(bucketName, { 
          public: true,
          fileSizeLimit: 52428800 // 50MB
        });
        
        if (createError) {
          console.error(`Failed to create bucket '${bucketName}':`, createError);
          throw createError;
        }
        
        console.log(`Successfully created public bucket '${bucketName}'`);
      } catch (bucketError) {
        console.error(`Error creating bucket '${bucketName}':`, bucketError);
        // Continue anyway - the bucket might exist but we don't have permission to check
        console.log("Continuing with upload operation despite bucket creation error");
      }
    } else {
      console.log(`Bucket '${bucketName}' already exists`);
    }
    
    // Set file paths for uploads with clear naming convention
    // Keep userId as part of the path for organization purposes
    const timestamp = Date.now();
    const overviewFilePath = `${userId}/${timestamp}-overview-${name}.pdf`;
    const impositionFilePath = `${userId}/${timestamp}-imposition-${name}.pdf`;
    
    console.log("Uploading batch overview PDF...");
    
    // First check if the file already exists
    const { data: existingOverview } = await supabase.storage
      .from(bucketName)
      .list(`${userId}`, {
        search: `${timestamp}-overview-${name}.pdf`
      });
      
    if (existingOverview && existingOverview.length > 0) {
      console.log("Found existing overview file, removing it first");
      await supabase.storage
        .from(bucketName)
        .remove([overviewFilePath]);
    }
    
    // Upload batch overview with timeout handling
    let overviewUploadAttempts = 0;
    let overviewUrl: string | null = null;
    
    while (overviewUploadAttempts < 3 && !overviewUrl) {
      try {
        // Upload batch overview
        const { error: overviewError } = await supabase.storage
          .from(bucketName)
          .upload(overviewFilePath, batchOverviewPDF, {
            contentType: "application/pdf",
            cacheControl: "no-cache",
            upsert: true
          });
          
        if (overviewError) {
          console.error("Overview upload error:", overviewError);
          overviewUploadAttempts++;
          if (overviewUploadAttempts >= 3) {
            throw overviewError;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Get URL for batch overview
        const { data: overviewUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(overviewFilePath);
          
        if (!overviewUrlData?.publicUrl) {
          throw new Error("Failed to get public URL for batch overview");
        }
        
        overviewUrl = overviewUrlData.publicUrl;
      } catch (err) {
        overviewUploadAttempts++;
        if (overviewUploadAttempts >= 3) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!overviewUrl) {
      throw new Error("Failed to upload batch overview after multiple attempts");
    }
    
    console.log("Uploading imposition sheet PDF...");
    
    // Check if imposition file exists
    const { data: existingImposition } = await supabase.storage
      .from(bucketName)
      .list(`${userId}`, {
        search: `${timestamp}-imposition-${name}.pdf`
      });
      
    if (existingImposition && existingImposition.length > 0) {
      console.log("Found existing imposition file, removing it first");
      await supabase.storage
        .from(bucketName)
        .remove([impositionFilePath]);
    }
    
    // Upload imposition sheet with retry logic
    let impositionUploadAttempts = 0;
    let impositionUrl: string | null = null;
    
    while (impositionUploadAttempts < 3 && !impositionUrl) {
      try {
        // Upload imposition sheet
        const { error: impositionError } = await supabase.storage
          .from(bucketName)
          .upload(impositionFilePath, impositionSheetPDF, {
            contentType: "application/pdf",
            cacheControl: "no-cache", // Prevent caching issues
            upsert: true
          });
          
        if (impositionError) {
          console.error("Imposition upload error:", impositionError);
          impositionUploadAttempts++;
          if (impositionUploadAttempts >= 3) {
            throw impositionError;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Get URL for imposition sheet
        const { data: impositionUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(impositionFilePath);
          
        if (!impositionUrlData?.publicUrl) {
          throw new Error("Failed to get public URL for imposition sheet");
        }
        
        impositionUrl = impositionUrlData.publicUrl;
      } catch (err) {
        impositionUploadAttempts++;
        if (impositionUploadAttempts >= 3) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!impositionUrl) {
      throw new Error("Failed to upload imposition sheet after multiple attempts");
    }
    
    console.log("Successfully uploaded both PDFs");
    console.log("Overview URL:", overviewUrl);
    console.log("Imposition URL:", impositionUrl);
    
    return {
      overviewUrl,
      impositionUrl
    };
  } catch (error) {
    console.error("Error in generateAndUploadBatchPDFs:", error);
    throw error;
  }
}
