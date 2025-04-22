
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
import { ProductConfig } from "@/config/productTypes";

export const useGenericJobSubmit = (config: ProductConfig) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (
    data: GenericJobFormValues,
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

      if (jobId) {
        // We're updating an existing job
        const updateData: any = {
          name: data.name,
          job_number: data.job_number,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
        };
        
        // Add optional fields if they exist in the form data
        if (data.size) updateData.size = data.size;
        if (data.paper_type) updateData.paper_type = data.paper_type;
        if (data.paper_weight) updateData.paper_weight = data.paper_weight;
        
        // Only include file data if a new file was uploaded
        if (pdfUrl && fileName) {
          updateData.pdf_url = pdfUrl;
          updateData.file_name = fileName;
        }
        
        // Use the config's tableName to ensure we update the correct table
        const { error } = await supabase
          .from(config.tableName)
          .update(updateData)
          .eq('id', jobId);
          
        if (error) throw error;
        
        toast.success(`${config.ui.jobFormTitle} updated successfully`);
      } else {
        // We're creating a new job
        const newJobData: any = {
          name: data.name,
          job_number: data.job_number,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
          pdf_url: pdfUrl!,
          file_name: fileName!,
          user_id: user?.id,
          status: 'queued'
        };
        
        // Add optional fields if they exist in the form data
        if (data.size) newJobData.size = data.size;
        if (data.paper_type) newJobData.paper_type = data.paper_type;
        if (data.paper_weight) newJobData.paper_weight = data.paper_weight;
        
        // Use the config's tableName to ensure we insert into the correct table
        const { error } = await supabase
          .from(config.tableName)
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
