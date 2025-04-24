
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
import { SleeveJobFormValues } from "@/lib/schema/sleeveJobFormSchema";
import { ProductConfig, TableName } from "@/config/productTypes";
import { isExistingTable, asSupabaseTable } from "@/utils/database/tableUtils";

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

      if (jobId) {
        // We're updating an existing job
        const updateData: any = {
          name: data.name,
          job_number: data.job_number,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
        };
        
        // Add product-specific fields
        if (config.productType === "Sleeves") {
          // Make sure we correctly type the data as SleeveJobFormValues
          const sleeveData = data as SleeveJobFormValues;
          updateData.stock_type = sleeveData.stock_type;
          updateData.single_sided = sleeveData.single_sided;
        } else {
          // Add optional fields if they exist in the form data
          if ('size' in data) updateData.size = data.size;
          if ('paper_type' in data) updateData.paper_type = data.paper_type;
          if ('paper_weight' in data) updateData.paper_weight = data.paper_weight;
        }
        
        // Only include file data if a new file was uploaded
        if (pdfUrl && fileName) {
          updateData.pdf_url = pdfUrl;
          updateData.file_name = fileName;
        }
        
        const { error } = await supabase
          .from(asSupabaseTable(tableName))
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
        }
        
        const { error } = await supabase
          .from(asSupabaseTable(tableName))
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
