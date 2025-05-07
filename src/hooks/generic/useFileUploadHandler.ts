
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Handles file upload to Supabase Storage
 */
export const useFileUploadHandler = () => {
  /**
   * Uploads a file to Supabase Storage and returns the public URL
   */
  const uploadFile = async (
    userId: string,
    selectedFile: File
  ): Promise<{ publicUrl: string; fileName: string } | null> => {
    try {
      if (!userId) {
        throw new Error("User ID is required for file upload");
      }

      if (!selectedFile) {
        throw new Error("No file selected for upload");
      }

      // Create a unique filename
      const uniqueFileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const filePath = `${userId}/${uniqueFileName}`;
      
      console.log("Preparing to upload file:", selectedFile.name);
      console.log("File size:", selectedFile.size, "bytes");
      console.log("File type:", selectedFile.type);
      console.log("Target path:", filePath);
      
      toast.loading("Uploading file...");
      
      // Check if bucket exists
      await ensureBucketExists();
      
      // Attempt to upload to the bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdf_files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true // Overwrite if exists
        });

      if (uploadError) {
        console.error("File upload error details:", uploadError);
        throw new Error(`Error uploading file: ${uploadError.message}`);
      }

      console.log("File uploaded successfully:", uploadData);

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('pdf_files')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error("Failed to get public URL for uploaded file");
      }

      console.log("Generated public URL:", urlData.publicUrl);
      toast.success("File uploaded successfully");
      
      return {
        publicUrl: urlData.publicUrl,
        fileName: selectedFile.name
      };
    } catch (error) {
      console.error("File upload error:", error);
      toast.error(`Upload error: ${error instanceof Error ? error.message : "Unknown error"}`);
      return null;
    }
  };

  /**
   * Ensures the 'pdf_files' bucket exists, creates it if needed
   */
  const ensureBucketExists = async (): Promise<void> => {
    try {
      console.log("Checking for storage bucket existence...");
      
      // Try to check for existing buckets without creating a new one first
      const { data: buckets, error: getBucketsError } = await supabase.storage.listBuckets();
      
      if (getBucketsError) {
        console.error("Error listing buckets:", getBucketsError);
        throw new Error(`Error checking storage buckets: ${getBucketsError.message}`);
      }
      
      const pdfBucketExists = buckets?.some(bucket => bucket.name === 'pdf_files');
      
      if (!pdfBucketExists) {
        console.log("Bucket 'pdf_files' doesn't exist, requesting creation through edge function");
        
        // Use our edge function to create the bucket
        const { error: functionError } = await supabase.functions.invoke('create_bucket', {
          body: { bucket_name: 'pdf_files' }
        });
        
        if (functionError) {
          console.error("Error creating bucket through edge function:", functionError);
          toast.error("Error setting up storage. Please try again or contact support.");
        } else {
          console.log("Bucket created successfully through edge function");
        }
      } else {
        console.log("Bucket 'pdf_files' already exists");
      }
    } catch (bucketError) {
      console.error("Error in bucket setup:", bucketError);
      // Continue with upload attempt even if bucket check fails
      toast.error("Storage preparation error. Upload may fail.");
    }
  };

  return { uploadFile };
};
