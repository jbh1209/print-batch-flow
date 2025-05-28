
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FlyerJobFormValues } from "../schema/flyerJobSchema";

export const useFlyerJobForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (
    data: FlyerJobFormValues, 
    selectedFile: File | null, 
    jobId?: string
  ) => {
    if (!selectedFile && !jobId) {
      toast.error("Please upload a PDF file");
      return false;
    }

    if (!user) {
      toast.error("You must be logged in to create a job");
      return false;
    }

    setIsSubmitting(true);
    
    try {
      let pdfUrl = undefined;
      let fileName = undefined;
      
      // Only upload a new file if one is selected
      if (selectedFile) {
        const uniqueFileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        const filePath = `${user.id}/${uniqueFileName}`;
        
        console.log(`Uploading file to: ${filePath}`);
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('pdf_files')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Error uploading file: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('pdf_files')
          .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
          throw new Error("Failed to get public URL for uploaded file");
        }
        
        pdfUrl = urlData.publicUrl;
        fileName = selectedFile.name;
      }

      if (jobId) {
        // Update existing job
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
          
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        
        toast.success("Flyer job updated successfully");
      } else {
        // Create new job
        if (!pdfUrl || !fileName) {
          throw new Error("File upload is required for new jobs");
        }

        const { error } = await supabase
          .from('flyer_jobs')
          .insert({
            name: data.name,
            job_number: data.job_number,
            size: data.size,
            paper_weight: data.paper_weight,
            paper_type: data.paper_type,
            quantity: data.quantity,
            due_date: data.due_date.toISOString(),
            pdf_url: pdfUrl,
            file_name: fileName,
            user_id: user.id,
            status: 'queued'
          });

        if (error) {
          console.error('Create error:', error);
          throw error;
        }

        toast.success("Flyer job created successfully");
      }
      
      navigate("/batchflow/batches/flyers/jobs");
      return true;
    } catch (error) {
      console.error("Error with flyer job:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to ${jobId ? 'update' : 'create'} flyer job: ${errorMessage}`);
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
