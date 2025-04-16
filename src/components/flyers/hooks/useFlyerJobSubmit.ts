
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

  const handleSubmit = async (data: FlyerJobFormValues, selectedFile: File) => {
    if (!selectedFile) {
      toast.error("Please upload a PDF file");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const fileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const filePath = `${user?.id}/${fileName}`;
      
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

      await createJob({
        name: data.name,
        job_number: data.job_number,
        size: data.size,
        paper_weight: data.paper_weight,
        paper_type: data.paper_type,
        quantity: data.quantity,
        due_date: data.due_date.toISOString(),
        pdf_url: urlData.publicUrl,
        file_name: selectedFile.name
      });

      toast.success("Flyer job created successfully");
      navigate("/batches/flyers/jobs");
    } catch (error) {
      console.error("Error creating flyer job:", error);
      toast.error(`Failed to create flyer job: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleSubmit,
    isSubmitting
  };
};
