
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PostcardJobFormValues } from "@/components/postcards/schema/postcardJobFormSchema";
import { useAuth } from "@/hooks/useAuth";

export const usePostcardJobSubmit = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (data: PostcardJobFormValues, selectedFile: File | null, jobId?: string) => {
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

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('pdf_files')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw new Error(`Error uploading file: ${uploadError.message}`);

        const { data: urlData } = supabase.storage
          .from('pdf_files')
          .getPublicUrl(filePath);

        if (!urlData?.publicUrl) throw new Error("Failed to get public URL for uploaded file");

        toast.success("File uploaded successfully");
        pdfUrl = urlData.publicUrl;
        fileName = selectedFile.name;
      }

      if (jobId) {
        // Update
        const updateData: any = {
          name: data.name,
          job_number: data.job_number,
          size: data.size,
          paper_type: data.paper_type,
          // Convert sides to lamination_type format for database storage
          // This stores the "sides" information in the existing lamination_type field
          lamination_type: data.lamination_type,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
        };
        if (pdfUrl && fileName) {
          updateData.pdf_url = pdfUrl;
          updateData.file_name = fileName;
        }
        const { error } = await supabase
          .from('postcard_jobs')
          .update(updateData)
          .eq('id', jobId);
        if (error) throw error;
        toast.success("Postcard job updated successfully");
      } else {
        // Create
        const { error } = await supabase.from('postcard_jobs').insert({
          name: data.name,
          job_number: data.job_number,
          size: data.size,
          paper_type: data.paper_type,
          // We're storing sides information in the existing database schema
          // Using the lamination_type field to store that information
          lamination_type: data.lamination_type,
          quantity: data.quantity,
          due_date: data.due_date.toISOString(),
          pdf_url: pdfUrl!,
          file_name: fileName!,
          status: 'queued',
          user_id: user?.id,
        });
        if (error) throw error;
        toast.success("Postcard job created successfully");
      }
      navigate("/batches/postcards/jobs");
      return true;
    } catch (error) {
      console.error("Error saving postcard job:", error);
      toast.error("Failed to save postcard job");
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
