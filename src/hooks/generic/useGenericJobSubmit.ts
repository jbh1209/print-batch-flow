
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
import { SleeveJobFormValues } from "@/lib/schema/sleeveJobFormSchema";
import { ProductConfig } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableValidation";

export const useGenericJobSubmit = (config: ProductConfig) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (
    data: GenericJobFormValues | SleeveJobFormValues,
    selectedFile: File | null,
    jobId?: string
  ) => {
    // If we're editing a job and no new file was selected, we can proceed
    // If we're creating a new job, we need a file
    if (!selectedFile && !jobId) {
      toast.error("Please upload a PDF file");
      return false;
    }

    setIsSubmitting(true);
    
    try {
      // Check if user is authenticated
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Authentication required. Please sign in.");
        navigate('/auth');
        return false;
      }
      
      const userId = session.session.user.id;
      
      // If we're editing and there's no new file, we don't need to upload again
      let pdfUrl = undefined;
      let fileName = undefined;
      
      // Only upload a new file if one is selected
      if (selectedFile) {
        const uniqueFileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        const filePath = `${userId}/${uniqueFileName}`;
        
        toast.loading("Uploading PDF file...");
        
        // Try to check for existing buckets without creating a new one first
        try {
          const { data: buckets, error: getBucketsError } = await supabase.storage.listBuckets();
          
          if (getBucketsError) {
            console.error("Error listing buckets:", getBucketsError);
            throw new Error(`Error checking storage buckets: ${getBucketsError.message}`);
          }
          
          const pdfBucketExists = buckets?.some(bucket => bucket.name === 'pdf_files');
          
          if (!pdfBucketExists) {
            console.log("Bucket 'pdf_files' doesn't exist, requesting creation through edge function");
            
            // Use our edge function to create the bucket instead of RPC
            const { error: functionError } = await supabase.functions.invoke('create_bucket', {
              body: { bucket_name: 'pdf_files' }
            });
            
            if (functionError) {
              console.error("Error creating bucket through edge function:", functionError);
              // Continue anyway - we'll attempt the upload and see if it works
            } else {
              console.log("Bucket created successfully through edge function");
            }
          } else {
            console.log("Bucket 'pdf_files' already exists");
          }
        } catch (bucketError) {
          console.error("Error in bucket setup:", bucketError);
          // Continue with upload attempt even if bucket check fails
        }
        
        // Attempt the upload to the bucket (which should exist or be publicly accessible)
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('pdf_files')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: true // Changed to true to overwrite if exists
          });

        if (uploadError) {
          throw new Error(`Error uploading file: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('pdf_files')
          .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
          throw new Error("Failed to get public URL for uploaded file");
        }

        toast.success("File uploaded successfully");
        
        pdfUrl = urlData.publicUrl;
        fileName = selectedFile.name;
      }

      const tableName = config.tableName;
      
      // Check if the table exists in the database before operations
      if (!isExistingTable(tableName)) {
        toast.error(`Table ${tableName} is not yet implemented in the database`);
        return false;
      }

      if (jobId) {
        // We're updating an existing job
        const updateData: any = {
          name: data.name,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
        };

        // Add job_number if it exists in the data
        if ('job_number' in data && data.job_number) {
          updateData.job_number = data.job_number;
        }
        
        // Add product-specific fields
        if (config.productType === "Sleeves") {
          // Make sure we correctly type the data as SleeveJobFormValues
          const sleeveData = data as SleeveJobFormValues;
          updateData.stock_type = sleeveData.stock_type;
          updateData.single_sided = sleeveData.single_sided;
        } else {
          // Add optional fields if they exist in the form data
          if ('size' in data && data.size) updateData.size = data.size;
          if ('paper_type' in data && data.paper_type) updateData.paper_type = data.paper_type;
          if ('paper_weight' in data && data.paper_weight) updateData.paper_weight = data.paper_weight;
          if ('lamination_type' in data && data.lamination_type) updateData.lamination_type = data.lamination_type;
          if ('sides' in data && data.sides) updateData.sides = data.sides;
          if ('uv_varnish' in data && data.uv_varnish) updateData.uv_varnish = data.uv_varnish;
        }
        
        // Only include file data if a new file was uploaded
        if (pdfUrl && fileName) {
          updateData.pdf_url = pdfUrl;
          updateData.file_name = fileName;
        }
        
        // Use 'as any' to bypass TypeScript's type checking for the table name
        const { error } = await supabase
          .from(tableName as any)
          .update(updateData)
          .eq('id', jobId);
          
        if (error) throw error;
        
        toast.success(`${config.ui.jobFormTitle} updated successfully`);
      } else {
        // We're creating a new job
        const newJobData: any = {
          name: data.name,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
          pdf_url: pdfUrl!,
          file_name: fileName!,
          user_id: userId,
          status: 'queued'
        };

        // Add job_number if it exists in the data
        if ('job_number' in data && data.job_number) {
          newJobData.job_number = data.job_number;
        }
        
        // Add product-specific fields
        if (config.productType === "Sleeves") {
          // Make sure we correctly type the data as SleeveJobFormValues
          const sleeveData = data as SleeveJobFormValues;
          newJobData.stock_type = sleeveData.stock_type;
          newJobData.single_sided = sleeveData.single_sided;
        } else {
          // Add optional fields if they exist in the form data
          if ('size' in data) newJobData.size = data.size;
          if ('paper_type' in data) newJobData.paper_type = data.paper_type;
          if ('paper_weight' in data) newJobData.paper_weight = data.paper_weight;
          if ('lamination_type' in data) newJobData.lamination_type = data.lamination_type;
          if ('sides' in data) newJobData.sides = data.sides;
          if ('uv_varnish' in data) newJobData.uv_varnish = data.uv_varnish;
        }
        
        console.log("Creating new job with data:", newJobData);
        console.log("Table name:", tableName);
        
        // Use 'as any' to bypass TypeScript's type checking for the table name
        const { error } = await supabase
          .from(tableName as any)
          .insert(newJobData);

        if (error) throw error;
        
        toast.success(`${config.ui.jobFormTitle} created successfully`);
      }
      
      navigate(config.routes.jobsPath);
      return true;
    } catch (error) {
      console.error(`Error with ${config.productType} job:`, error);
      toast.error(`Failed to ${jobId ? 'update' : 'create'} ${config.ui.jobFormTitle.toLowerCase()}: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleSubmit,
    isSubmitting
  };
};
