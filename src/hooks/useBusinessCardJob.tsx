
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/tracker/useUserRole";

type JobData = {
  name: string;
  quantity: number;
  double_sided: boolean;
  due_date: string;
  pdf_url?: string;
  file_name?: string;
  // Specifications are now stored separately
  // Legacy fields removed: lamination_type, paper_type
};

export function useBusinessCardJob(jobId: string | undefined) {
  const { user } = useAuth();
  const { isAdmin, isManager, isDtpOperator } = useUserRole();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobData, setJobData] = useState<JobData | null>(null);

  // Check if user can edit all jobs (admin, manager, DTP operators)
  const canEditAllJobs = isAdmin || isManager || isDtpOperator;

  // Fetch job data
  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId || !user) return;
      
      try {
        // Build query conditionally based on user permissions
        let query = supabase
          .from("business_card_jobs")
          .select("*")
          .eq("id", jobId);
        
        // Only filter by user_id if user doesn't have permission to edit all jobs
        if (!canEditAllJobs) {
          query = query.eq("user_id", user.id);
        }
        
        const { data, error } = await query.maybeSingle();
          
        if (error) throw error;
        
        if (!data) {
          setError(canEditAllJobs 
            ? "Job not found." 
            : "Job not found or you don't have permission to view it."
          );
          return;
        }
        
        // Map database fields to expected interface
        const mappedData: JobData = {
          name: data.name,
          quantity: data.quantity,
          double_sided: data.double_sided,
          due_date: data.due_date,
          pdf_url: data.pdf_url,
          file_name: data.file_name
        };
        
        setJobData(mappedData);
      } catch (error) {
        console.error("Error fetching job:", error);
        setError("Failed to load job details.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchJobData();
  }, [jobId, user, canEditAllJobs]);

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

      // Update job data in the database - only core fields
      const updateData: Record<string, any> = {
        name: formData.name,
        quantity: formData.quantity,
        double_sided: formData.doubleSided,
        due_date: formData.dueDate.toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Only add file data if a new file was uploaded
      if (pdfUrl && fileName) {
        updateData.pdf_url = pdfUrl;
        updateData.file_name = fileName;
      }

      // Build update query conditionally based on user permissions
      let updateQuery = supabase
        .from("business_card_jobs")
        .update(updateData)
        .eq("id", jobId);
      
      // Only filter by user_id if user doesn't have permission to edit all jobs
      if (!canEditAllJobs) {
        updateQuery = updateQuery.eq("user_id", user.id);
      }
      
      const { error: updateError } = await updateQuery;

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
