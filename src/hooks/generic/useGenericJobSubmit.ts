
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
import { SleeveJobFormValues } from "@/lib/schema/sleeveJobFormSchema";
import { ProductConfig } from "@/config/productTypes";
import { isExistingTable } from "@/utils/database/tableUtils";
import { transformJobDataForTable } from "@/utils/database/productDataTransformers";

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
      // If we're editing and there's no new file, we don't need to upload again
      let pdfUrl = undefined;
      let fileName = undefined;
      
      // Only upload a new file if one is selected
      if (selectedFile) {
        const uniqueFileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        const filePath = `${user?.id}/${uniqueFileName}`;
        
        toast.loading("Uploading PDF file...");
        
        // Check if the bucket exists
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
          console.error('Error checking buckets:', bucketsError);
        } else {
          const pdfBucketExists = buckets.some(bucket => bucket.id === 'pdf_files');
          if (!pdfBucketExists) {
            console.warn('pdf_files bucket does not exist - it should have been created by the migration');
          }
        }
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('pdf_files')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
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

      // Create base job data that all products need
      const baseJobData = {
        name: data.name,
        job_number: data.job_number,
        quantity: data.quantity,
        due_date: data.due_date.toISOString(),
        user_id: user?.id!,
        status: 'queued'
      };

      if (jobId) {
        // We're updating an existing job
        const updateData = { ...baseJobData };
        
        // Only include file data if a new file was uploaded
        if (pdfUrl && fileName) {
          Object.assign(updateData, {
            pdf_url: pdfUrl,
            file_name: fileName
          });
        }
        
        // Use transformer to get the correct fields for this table
        const transformedData = transformJobDataForTable(tableName, data, {
          ...baseJobData,
          pdf_url: pdfUrl || '',
          file_name: fileName || ''
        });
        
        // Remove fields that shouldn't be in update (like user_id, status for updates)
        const { user_id, status, pdf_url: _, file_name: __, ...updateFields } = transformedData;
        const finalUpdateData = { ...updateFields };
        
        // Add file data back if we have it
        if (pdfUrl && fileName) {
          Object.assign(finalUpdateData, {
            pdf_url: pdfUrl,
            file_name: fileName
          });
        }
        
        console.log(`Updating ${config.productType} job with data:`, finalUpdateData);
        
        const { error } = await supabase
          .from(tableName as any)
          .update(finalUpdateData)
          .eq('id', jobId);
          
        if (error) throw error;
        
        toast.success(`${config.ui.jobFormTitle} updated successfully`);
      } else {
        // We're creating a new job
        const newJobData = transformJobDataForTable(tableName, data, {
          ...baseJobData,
          pdf_url: pdfUrl!,
          file_name: fileName!
        });
        
        console.log(`Creating ${config.productType} job with data:`, newJobData);
        
        const { error } = await supabase
          .from(tableName as any)
          .insert(newJobData);

        if (error) {
          console.error(`Database error for ${config.productType}:`, error);
          throw error;
        }
        
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
