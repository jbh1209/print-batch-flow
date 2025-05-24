
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { FlyerJobFormValues } from "../schema/flyerJobFormSchema";
import { useAuth } from "@/hooks/useAuth";

export const useFlyerJobSubmit = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { createJob } = useFlyerJobs();
  const { user } = useAuth();

  const handleSubmit = async (data: FlyerJobFormValues, selectedFile: File | null, jobId?: string) => {
    // If we're editing a job and no new file was selected, we can proceed without file validation
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
        
        // Check if the bucket exists, create if it doesn't
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

      if (jobId) {
        // We're updating an existing job - remove user_id check
        const updateData: any = {
          name: data.name,
          job_number: data.job_number,
          size: data.size,
          paper_weight: data.paper_weight,
          paper_type: data.paper_type,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
        };
        
        // Only include file data if a new file was uploaded
        if (pdfUrl && fileName) {
          updateData.pdf_url = pdfUrl;
          updateData.file_name = fileName;
        }
        
        const { error } = await supabase
          .from('flyer_jobs')
          .update(updateData)
          .eq('id', jobId);
          
        if (error) throw error;
        
        toast.success("Flyer job updated successfully");
      } else {
        // We're creating a new job
        await createJob({
          name: data.name,
          job_number: data.job_number,
          size: data.size,
          paper_weight: data.paper_weight,
          paper_type: data.paper_type,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
          pdf_url: pdfUrl!,
          file_name: fileName!
        });

        toast.success("Flyer job created successfully");
      }
      
      navigate("/batches/flyers/jobs");
      return true;
    } catch (error) {
      console.error("Error with flyer job:", error);
      toast.error(`Failed to ${jobId ? 'update' : 'create'} flyer job: ${error instanceof Error ? error.message : "Unknown error"}`);
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
