
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
import { SleeveJobFormValues } from "@/lib/schema/sleeveJobFormSchema";
import { ProductConfig } from "@/config/productTypes";
import { useFileUploadHandler } from "./useFileUploadHandler";
import { useJobDatabase } from "./useJobDatabase";
import { useSessionCheck } from "./useSessionCheck";

export const useGenericJobSubmit = (config: ProductConfig) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { uploadFile } = useFileUploadHandler();
  const { createJob, updateJob } = useJobDatabase();
  const { validateSession } = useSessionCheck();

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
      const userId = await validateSession();
      if (!userId) {
        return false;
      }
      
      // If we're editing and there's no new file, we don't need to upload again
      let pdfUrl = undefined;
      let fileName = undefined;
      
      // Only upload a new file if one is selected
      if (selectedFile) {
        const uploadResult = await uploadFile(userId, selectedFile);
        
        if (!uploadResult) {
          return false;
        }
        
        pdfUrl = uploadResult.publicUrl;
        fileName = uploadResult.fileName;
      }

      const tableName = config.tableName;
      
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
        
        // Update the existing job
        const success = await updateJob(tableName, jobId, updateData);
        if (!success) return false;
        
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
        
        // Create the new job
        const success = await createJob(tableName, newJobData);
        if (!success) return false;
        
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
