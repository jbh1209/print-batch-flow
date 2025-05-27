
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateBatchOverview } from "@/utils/batchGeneration";
import { Job, BatchDetailsType } from "./types/BatchTypes";
import { BaseJob } from "@/config/productTypes";

interface BatchOverviewGeneratorProps {
  batch: BatchDetailsType;
  relatedJobs: Job[];
  onRefresh?: () => void;
}

export const BatchOverviewGenerator = ({ 
  batch, 
  relatedJobs, 
  onRefresh 
}: BatchOverviewGeneratorProps) => {
  const { user } = useAuth();
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);
  
  // Check if this batch needs an overview PDF generated
  useEffect(() => {
    const checkOverviewStatus = async () => {
      if (!batch.overview_pdf_url) {
        // Check if the batch is marked as needing an overview PDF
        const { data, error } = await supabase
          .from("batches")
          .select("needs_overview_pdf")
          .eq("id", batch.id)
          .single();
          
        if (data?.needs_overview_pdf && relatedJobs.length > 0) {
          // Generate the overview PDF
          await handleGenerateAndUploadOverview();
        }
      }
    };
    
    checkOverviewStatus();
  }, [batch.id, batch.overview_pdf_url, relatedJobs]);

  // Convert Job[] to BaseJob[] for FlyerBatchOverview with proper type casting
  const convertToBaseJobs = (jobs: Job[]): BaseJob[] => {
    return jobs.map(job => ({
      ...job,
      job_number: job.job_number || job.name,
      updated_at: job.updated_at || new Date().toISOString(),
      user_id: job.user_id || ""
    })) as unknown as BaseJob[];
  };

  // Function to generate and upload the overview PDF
  const handleGenerateAndUploadOverview = async () => {
    if (!user || relatedJobs.length === 0 || isGeneratingOverview) return;
    
    setIsGeneratingOverview(true);
    toast.loading("Generating batch overview PDF...");
    
    try {
      console.log("=== BATCH OVERVIEW GENERATOR - GENERATING OVERVIEW ===");
      console.log("Batch sheets_required:", batch.sheets_required);
      console.log("Type of batch.sheets_required:", typeof batch.sheets_required);
      
      const pdfBytes = await generateBatchOverview(
        convertToBaseJobs(relatedJobs),
        batch.name,
        batch.sheets_required || 0
      );
      
      // Upload to storage
      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}-overview-${batch.name}.pdf`;
      
      const { error: uploadError } = await supabase.storage
        .from("pdf_files")
        .upload(filePath, pdfBytes, {
          contentType: "application/pdf",
          cacheControl: "max-age=31536000",
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("pdf_files")
        .getPublicUrl(filePath);
        
      if (!urlData?.publicUrl) {
        throw new Error("Failed to get public URL for batch overview");
      }
      
      // Update the batch record with the overview PDF URL
      const { error: updateError } = await supabase
        .from("batches")
        .update({ 
          overview_pdf_url: urlData.publicUrl,
          needs_overview_pdf: false
        })
        .eq("id", batch.id);
        
      if (updateError) throw updateError;
      
      toast.success("Batch overview PDF generated");
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error generating batch overview:", error);
      toast.error("Failed to generate batch overview PDF");
    } finally {
      setIsGeneratingOverview(false);
    }
  };

  return {
    isGeneratingOverview,
    handleGenerateAndUploadOverview,
    convertToBaseJobs
  };
};
