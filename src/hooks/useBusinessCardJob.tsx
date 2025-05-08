
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { processJobData, castToUUID, prepareUpdateParams } from "@/utils/database/dbHelpers";

type JobData = {
  name: string;
  quantity: number;
  double_sided: boolean;
  lamination_type: "none" | "gloss" | "matt" | "soft_touch";
  paper_type: string;
  due_date: string;
  pdf_url?: string;
  file_name?: string;
};

export function useBusinessCardJob(jobId: string | undefined) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobData | null>(null);

  // Fetch job data
  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId || !user) return;
      
      try {
        const { data, error } = await supabase
          .from("business_card_jobs")
          .select("*")
          .eq("id", castToUUID(jobId))
          .eq("user_id", castToUUID(user.id))
          .single();
          
        if (error) throw error;
        
        if (!data) {
          setError("Job not found or you don't have permission to view it.");
          return;
        }
        
        // Use processJobData to ensure type safety
        const processedData = processJobData<JobData>(data);
        if (processedData) {
          setJobData(processedData);
        } else {
          setError("Failed to process job data");
        }
      } catch (error) {
        console.error("Error fetching job:", error);
        setError("Failed to load job details.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchJobData();
  }, [jobId, user]);

  const updateJob = async (formData: any, selectedFile: File | null) => {
    if (!user) {
      toast.error("Authentication error", {
        description: "You must be logged in to update jobs"
      });
      return false;
    }

    if (!jobId) {
      toast.error("Error", {
        description: "Job ID is missing"
      });
      return false;
    }

    setIsSaving(true);
    try {
      let pdfUrl = undefined;
      let fileName = undefined;
      
      // If a new file was selected, upload it
      if (selectedFile) {
        const filePath = `${user.id}/${selectedFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("pdf_files")
          .upload(filePath, selectedFile, { upsert: true });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        // Get the public URL for the uploaded file
        const { data: urlData } = supabase.storage
          .from("pdf_files")
          .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
          throw new Error("Failed to get public URL for uploaded file");
        }
        
        pdfUrl = urlData.publicUrl;
        fileName = selectedFile.name;
      }

      // Update job data in the database
      const updateData: Record<string, any> = {
        name: formData.name,
        quantity: formData.quantity,
        double_sided: formData.doubleSided,
        lamination_type: formData.laminationType,
        paper_type: formData.paperType,
        due_date: formData.dueDate.toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Only add file data if a new file was uploaded
      if (pdfUrl && fileName) {
        updateData.pdf_url = pdfUrl;
        updateData.file_name = fileName;
      }
      
      // Use prepareUpdateParams for type safety
      const preparedData = prepareUpdateParams(updateData);

      const { error: updateError } = await supabase
        .from("business_card_jobs")
        .update(preparedData)
        .eq("id", castToUUID(jobId))
        .eq("user_id", castToUUID(user.id));

      if (updateError) {
        throw new Error(updateError.message);
      }

      toast.success("Job updated successfully");
      return true;
    } catch (error) {
      console.error("Error updating job:", error);
      toast.error("Error updating job", {
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { 
    isLoading, 
    isSaving, 
    error, 
    jobData, 
    updateJob 
  };
}
