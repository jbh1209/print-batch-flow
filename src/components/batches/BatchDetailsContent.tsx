import React, { useEffect, useState } from "react";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";
import { FlyerBatchOverview } from "../flyers/FlyerBatchOverview";
import { downloadBatchJobPdfs, downloadIndividualBatchJobPdfs } from "@/utils/pdf/batchJobPdfUtils";
import { toast } from "sonner";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { BaseJob } from "@/config/productTypes";
import { generateBatchOverview } from "@/utils/batchGeneration"; 
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface BatchDetailsContentProps {
  batch: BatchDetailsType;
  relatedJobs: Job[];
  productType: string;
  onDeleteClick: () => void;
  onRefresh?: () => void;
}

const BatchDetailsContent = ({ 
  batch, 
  relatedJobs, 
  productType,
  onDeleteClick,
  onRefresh
}: BatchDetailsContentProps) => {
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

  // Function to generate and upload the overview PDF
  const handleGenerateAndUploadOverview = async () => {
    if (!user || relatedJobs.length === 0 || isGeneratingOverview) return;
    
    setIsGeneratingOverview(true);
    toast.loading("Generating batch overview PDF...");
    
    try {
      // Generate the PDF bytes - ensure we pass the sheets_required from the batch
      console.log("=== BATCH DETAILS CONTENT - GENERATING OVERVIEW ===");
      console.log("Batch sheets_required:", batch.sheets_required);
      console.log("Type of batch.sheets_required:", typeof batch.sheets_required);
      
      const pdfBytes = await generateBatchOverview(
        convertToBaseJobs(relatedJobs),
        batch.name,
        batch.sheets_required || 0 // Ensure we pass the actual sheets required value
      );
      
      // Upload to storage
      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}-overview-${batch.name}.pdf`;
      
      const { error: uploadError } = await supabase.storage
        .from("pdf_files")
        .upload(filePath, pdfBytes, {
          contentType: "application/pdf",
          cacheControl: "max-age=31536000", // 1 year cache since this is permanent
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
      
      // Update the parent component if a refresh function is provided
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
  
  const handleDownloadJobPdfs = async () => {
    if (relatedJobs.length === 0) {
      toast.error("No jobs available to download", {
        description: "This batch doesn't have any linked jobs yet"
      });
      return;
    }
    
    try {
      // Use the combined PDF generator
      await downloadBatchJobPdfs(relatedJobs, batch.name);
    } catch (error) {
      console.error("Error downloading job PDFs:", error);
      toast.error("Failed to download job PDFs");
    }
  };

  const handleDownloadIndividualJobPdfs = async () => {
    if (relatedJobs.length === 0) {
      toast.error("No jobs available to download", {
        description: "This batch doesn't have any linked jobs yet"
      });
      return;
    }
    
    try {
      // Use the individual PDFs function (ZIP file)
      await downloadIndividualBatchJobPdfs(relatedJobs, batch.name);
    } catch (error) {
      console.error("Error downloading individual job PDFs:", error);
      toast.error("Failed to download individual job PDFs");
    }
  };

  const handleDownloadBatchOverviewSheet = async () => {
    let toastId: string | number | undefined;
    
    try {
      // Check if batch overview PDF URL exists
      const overviewPdfUrl = batch.overview_pdf_url || batch.back_pdf_url;
      
      if (!overviewPdfUrl) {
        // If no overview PDF exists yet, generate one with the correct sheets required
        if (relatedJobs.length > 0) {
          console.log("=== BATCH DETAILS CONTENT - DOWNLOAD OVERVIEW ===");
          console.log("Batch object:", batch);
          console.log("Batch.sheets_required:", batch.sheets_required);
          console.log("Type of batch.sheets_required:", typeof batch.sheets_required);
          console.log("Generating new overview with sheets_required:", batch.sheets_required);
          
          // Add cache-busting timestamp
          const timestamp = Date.now();
          console.log("Cache-busting timestamp for PDF generation:", timestamp);
          
          // Generate the PDF bytes with the actual sheets required from the batch
          const pdfBytes = await generateBatchOverview(
            convertToBaseJobs(relatedJobs),
            batch.name,
            batch.sheets_required || 0
          );
          
          // Create a blob and download it directly
          const blob = new Blob([pdfBytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${batch.name}-overview-${timestamp}.pdf`; // Add timestamp to filename
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          toast.success("Batch overview sheet downloaded successfully");
          return;
        } else {
          toast.error("No batch overview sheet available", {
            description: "This batch doesn't have jobs or an overview PDF"
          });
          return;
        }
      }

      console.log("Downloading existing batch overview sheet:", overviewPdfUrl);
      toastId = toast.loading("Downloading batch overview sheet...");
      
      await handlePdfAction(overviewPdfUrl, 'download', `${batch.name}-overview.pdf`);
      
      // Dismiss the loading toast and show success
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.success("Batch overview sheet downloaded successfully");
      
    } catch (error) {
      console.error("Error downloading batch overview sheet:", error);
      
      // Dismiss the loading toast and show error
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.error("Failed to download batch overview sheet");
    }
  };
  
  // Convert Job[] to BaseJob[] for FlyerBatchOverview with proper type casting
  const convertToBaseJobs = (jobs: Job[]): BaseJob[] => {
    // Explicitly cast to unknown first, then to BaseJob[] to avoid type errors
    return jobs.map(job => ({
      ...job,
      job_number: job.job_number || job.name, // Use job_number if available, otherwise use name
      updated_at: job.updated_at || new Date().toISOString(), // Use provided updated_at or default
      user_id: job.user_id || "" // Use provided user_id or default
    })) as unknown as BaseJob[];
  };
  
  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        <BatchDetailsCard 
          batch={batch}
          onDeleteClick={onDeleteClick}
          onStatusUpdate={onRefresh}
        />
        <BatchActionsCard 
          batch={batch} 
          onDownloadJobPdfs={handleDownloadJobPdfs}
          onDownloadIndividualJobPdfs={handleDownloadIndividualJobPdfs}
          onDownloadBatchOverviewSheet={handleDownloadBatchOverviewSheet}
        />
      </div>

      {relatedJobs.length > 0 ? (
        <>
          <RelatedJobsCard jobs={relatedJobs} />
          <FlyerBatchOverview 
            jobs={convertToBaseJobs(relatedJobs)}
            batchName={batch.name}
          />
        </>
      ) : batch.overview_pdf_url ? (
        <div className="mt-6 p-6 bg-white border rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Overview</h3>
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-gray-500 mb-4">
              Job details are no longer available, but you can view the batch overview.
            </p>
            <button
              onClick={handleDownloadBatchOverviewSheet}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
            >
              Download Overview Sheet
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Found</h3>
          <p className="text-gray-500">
            This batch doesn't have any jobs linked to it yet. 
            There might have been an issue during batch creation.
          </p>
        </div>
      )}
    </>
  );
};

export default BatchDetailsContent;
