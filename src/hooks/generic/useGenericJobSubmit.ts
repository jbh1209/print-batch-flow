
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
import { useJobSpecificationStorage } from "@/hooks/useJobSpecificationStorage";

export const useGenericJobSubmit = (config: ProductConfig) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { saveJobSpecifications } = useJobSpecificationStorage();

  const handleSubmit = async (
    data: GenericJobFormValues | SleeveJobFormValues,
    selectedFile: File | null,
    jobId?: string,
    specifications?: Record<string, any>
  ) => {
    if (!selectedFile && !jobId) {
      toast.error("Please upload a PDF file");
      return false;
    }

    setIsSubmitting(true);
    
    try {
      let pdfUrl = undefined;
      let fileName = undefined;
      
      if (selectedFile) {
        const uniqueFileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        const filePath = `${user?.id}/${uniqueFileName}`;
        
        toast.loading("Uploading PDF file...");
        
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
      
      if (!isExistingTable(tableName)) {
        toast.error(`Table ${tableName} is not yet implemented in the database`);
        return false;
      }

      const baseJobData = {
        name: data.name,
        job_number: data.job_number,
        quantity: data.quantity,
        due_date: data.due_date.toISOString(),
        user_id: user?.id!,
        status: 'queued'
      };

      let finalJobId = jobId;

      if (jobId) {
        const updateData = { ...baseJobData };
        
        if (pdfUrl && fileName) {
          Object.assign(updateData, {
            pdf_url: pdfUrl,
            file_name: fileName
          });
        }
        
        const transformedData = transformJobDataForTable(tableName, data, {
          ...baseJobData,
          pdf_url: pdfUrl || '',
          file_name: fileName || ''
        });
        
        const { user_id, status, pdf_url: _, file_name: __, ...updateFields } = transformedData;
        const finalUpdateData = { ...updateFields };
        
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
        const newJobData = transformJobDataForTable(tableName, data, {
          ...baseJobData,
          pdf_url: pdfUrl!,
          file_name: fileName!
        });
        
        console.log(`Creating ${config.productType} job with data:`, newJobData);
        
        const { data: insertResult, error } = await supabase
          .from(tableName as any)
          .insert(newJobData)
          .select('id')
          .single();

        if (error) {
          console.error(`Database error for ${config.productType}:`, error);
          throw error;
        }

        // More explicit null check and type assertion
        if (!insertResult) {
          throw new Error("Failed to create job - no result returned");
        }
        
        if (typeof insertResult !== 'object' || !('id' in insertResult)) {
          throw new Error("Failed to create job - invalid result structure");
        }

        finalJobId = insertResult.id as string;
        
        toast.success(`${config.ui.jobFormTitle} created successfully`);
      }

      if (finalJobId && specifications && Object.keys(specifications).length > 0) {
        try {
          await saveJobSpecifications(finalJobId, tableName, specifications);
        } catch (specError) {
          console.error('Failed to save specifications:', specError);
          toast.error('Job created but failed to save specifications');
        }
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
