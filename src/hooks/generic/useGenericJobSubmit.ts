
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
  const { createJob, updateJob, validateJobFields } = useJobDatabase();
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
        setIsSubmitting(false);
        return false;
      }
      
      console.log("Job submission started:", config.productType);
      console.log("Form data:", JSON.stringify(data, null, 2));
      console.log("Selected file:", selectedFile ? selectedFile.name : "No new file");
      
      // If we're editing and there's no new file, we don't need to upload again
      let pdfUrl = undefined;
      let fileName = undefined;
      
      // Only upload a new file if one is selected
      if (selectedFile) {
        console.log("Uploading file for", config.productType, "job");
        const uploadResult = await uploadFile(userId, selectedFile);
        
        if (!uploadResult) {
          setIsSubmitting(false);
          return false;
        }
        
        pdfUrl = uploadResult.publicUrl;
        fileName = uploadResult.fileName;
        console.log("File uploaded successfully:", fileName);
      }

      const tableName = config.tableName;
      console.log("Using table name:", tableName);
      
      if (jobId) {
        // We're updating an existing job
        const updateData: Record<string, any> = {
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
          // Add optional fields if they exist in the form data and config
          if ('size' in data && data.size && config.hasSize) updateData.size = data.size;
          if ('paper_type' in data && data.paper_type && config.hasPaperType) updateData.paper_type = data.paper_type;
          if ('paper_weight' in data && data.paper_weight && config.hasPaperWeight) updateData.paper_weight = data.paper_weight;
          if ('lamination_type' in data && data.lamination_type && config.hasLamination) updateData.lamination_type = data.lamination_type;
          if ('sides' in data && data.sides && config.hasSides) updateData.sides = data.sides;
          if ('uv_varnish' in data && data.uv_varnish && config.hasUVVarnish) updateData.uv_varnish = data.uv_varnish;
        }
        
        // Only include file data if a new file was uploaded
        if (pdfUrl && fileName) {
          updateData.pdf_url = pdfUrl;
          updateData.file_name = fileName;
        }
        
        console.log("Updating existing job with ID:", jobId);
        console.log("Update data:", updateData);
        
        // Validate the update data against the database schema
        const validationResult = await validateJobFields(tableName, updateData);
        if (!validationResult.valid) {
          if (validationResult.invalidFields && validationResult.invalidFields.length > 0) {
            console.error("Invalid fields detected:", validationResult.invalidFields);
            toast.error(`Schema mismatch: Some fields don't exist in the database: ${validationResult.invalidFields.join(', ')}`);
            setIsSubmitting(false);
            return false;
          }
        }
        
        // Update the existing job
        const success = await updateJob(tableName, jobId, updateData);
        if (!success) {
          setIsSubmitting(false);
          return false;
        }
        
        toast.success(`${config.ui.jobFormTitle} updated successfully`);
      } else {
        // We're creating a new job
        const newJobData: Record<string, any> = {
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
        
        // Add product-specific fields based on the config
        if (config.productType === "Sleeves") {
          // Make sure we correctly type the data as SleeveJobFormValues
          const sleeveData = data as SleeveJobFormValues;
          newJobData.stock_type = sleeveData.stock_type;
          newJobData.single_sided = sleeveData.single_sided;
        } else {
          // Add product-specific fields based on the config and form data
          if ('size' in data && config.hasSize) newJobData.size = data.size;
          if ('paper_type' in data && config.hasPaperType) newJobData.paper_type = data.paper_type;
          if ('paper_weight' in data && config.hasPaperWeight) newJobData.paper_weight = data.paper_weight;
          if ('lamination_type' in data && config.hasLamination) newJobData.lamination_type = data.lamination_type;
          if ('sides' in data && config.hasSides) newJobData.sides = data.sides;
          if ('uv_varnish' in data && config.hasUVVarnish) newJobData.uv_varnish = data.uv_varnish;
        }
        
        console.log("Creating new job with data:", newJobData);
        
        // Validate the new job data against the database schema
        const validationResult = await validateJobFields(tableName, newJobData);
        if (!validationResult.valid) {
          if (validationResult.invalidFields && validationResult.invalidFields.length > 0) {
            console.error("Invalid fields detected:", validationResult.invalidFields);
            toast.error(`Schema mismatch: Some fields don't exist in the database: ${validationResult.invalidFields.join(', ')}`);
            setIsSubmitting(false);
            return false;
          }
        }
        
        // Create the new job
        const success = await createJob(tableName, newJobData);
        if (!success) {
          setIsSubmitting(false);
          return false;
        }
        
        toast.success(`${config.ui.jobFormTitle} created successfully`);
      }
      
      // Navigate back to the jobs list
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
