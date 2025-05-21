import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/components/business-cards/JobsTable";
import { BaseJob } from "@/config/productTypes";
import { generateBatchOverview } from "./batchGeneration";
import { generateImpositionSheet } from "./batchImposition";
import { toast } from "sonner";

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
    
    // First verify the bucket exists without trying to create it
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      throw new Error(`Cannot access storage buckets: ${listError.message}`);
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === "pdf_files");
    
    if (!bucketExists) {
      console.warn("Bucket 'pdf_files' doesn't exist. Upload may fail if you don't have permission to create it.");
    } else {
      console.log("Bucket 'pdf_files' exists, will use it for uploads");
    }
    
    // Set file paths for uploads with clear naming convention
    // Keep userId as the first folder for RLS policy to work
    const timestamp = Date.now();
    const overviewFilePath = `${userId}/${timestamp}-overview-${name}.pdf`;
    const impositionFilePath = `${userId}/${timestamp}-imposition-${name}.pdf`;
    
    console.log("Uploading batch overview PDF...");
    
    // First check if the file already exists
    const { data: existingOverview } = await supabase.storage
      .from("pdf_files")
      .list(`${userId}`, {
        search: `${timestamp}-overview-${name}.pdf`
      });
      
    if (existingOverview && existingOverview.length > 0) {
      console.log("Found existing overview file, removing it first");
      await supabase.storage
        .from("pdf_files")
        .remove([overviewFilePath]);
    }
    
    // Upload batch overview with timeout handling
    let overviewUploadAttempts = 0;
    let overviewUrl: string | null = null;
    
    while (overviewUploadAttempts < 3 && !overviewUrl) {
      try {
        // Upload batch overview
        const { error: overviewError } = await supabase.storage
          .from("pdf_files")
          .upload(overviewFilePath, batchOverviewPDF, {
            contentType: "application/pdf",
            cacheControl: "no-cache",
            upsert: true
          });
          
        if (overviewError) {
          console.error("Overview upload error:", overviewError);
          console.error("Error details:", overviewError.message);
          
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
          .from("pdf_files")
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
      .from("pdf_files")
      .list(`${userId}`, {
        search: `${timestamp}-imposition-${name}.pdf`
      });
      
    if (existingImposition && existingImposition.length > 0) {
      console.log("Found existing imposition file, removing it first");
      await supabase.storage
        .from("pdf_files")
        .remove([impositionFilePath]);
    }
    
    // Upload imposition sheet with retry logic
    let impositionUploadAttempts = 0;
    let impositionUrl: string | null = null;
    
    while (impositionUploadAttempts < 3 && !impositionUrl) {
      try {
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
          console.error("Error details:", impositionError.message);
          
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
          .from("pdf_files")
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

// Helper function to check if bucket exists and is public without trying to create/update it
async function ensurePublicBucket(bucketName: string): Promise<boolean> {
  try {
    // First check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    
    let bucketExists = false;
    if (buckets) {
      bucketExists = buckets.some(bucket => bucket.name === bucketName);
    }
    
    if (!bucketExists) {
      console.log(`Bucket '${bucketName}' doesn't exist, attempting to create it...`);
      
      try {
        // Try to create the bucket with public access
        const { error: createError } = await supabase.storage.createBucket(bucketName, { 
          public: true,
          fileSizeLimit: 52428800 // 50MB
        });
        
        if (createError) {
          console.warn(`Could not create bucket '${bucketName}':`, createError);
          console.log("Will try to upload anyway, in case bucket already exists but user can't create it");
          return true; // Return true anyway to try the upload
        }
        
        console.log(`Successfully created public bucket '${bucketName}'`);
        return true;
      } catch (error) {
        console.warn(`Error creating bucket '${bucketName}':`, error);
        console.log("Will try to upload anyway, in case bucket already exists but user can't create it");
        return true; // Return true anyway to try the upload
      }
    }
    
    console.log(`Bucket '${bucketName}' already exists`);
    
    try {
      // Get bucket details
      const { data: bucketData, error: getBucketError } = await supabase.storage.getBucket(bucketName);
      
      // If bucket exists but isn't public, try to update it
      if (bucketData && !bucketData.public) {
        console.log(`Bucket '${bucketName}' exists but is not public, attempting to update...`);
        
        try {
          const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
            public: true
          });
          
          if (updateError) {
            console.warn(`Failed to update bucket '${bucketName}' to public:`, updateError);
            console.log("Will try to upload anyway");
          } else {
            console.log(`Successfully updated bucket '${bucketName}' to be public`);
          }
        } catch (error) {
          console.warn(`Error updating bucket '${bucketName}':`, error);
          console.log("Will try to upload anyway");
        }
      } else {
        console.log(`Bucket '${bucketName}' already exists and is public`);
      }
    } catch (error) {
      console.warn(`Error checking bucket '${bucketName}' publicity:`, error);
      console.log("Will try to upload anyway");
    }
    
    return true; // Always return true to try the upload
  } catch (error) {
    console.warn(`Error ensuring public bucket '${bucketName}':`, error);
    console.log("Will try to upload anyway");
    return true; // Always return true to try the upload
  }
}
