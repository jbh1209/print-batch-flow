
import React from "react";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";
import { FlyerBatchOverview } from "../flyers/FlyerBatchOverview";
import { toast } from "sonner";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { BaseJob } from "@/config/productTypes";
import { downloadBatchJobPdfs } from "@/utils/pdf/batchJobPdfUtils";

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
  
  const handleDownloadJobPdfs = async () => {
    if (relatedJobs.length === 0) {
      toast.error("No jobs available to download");
      return;
    }
    
    try {
      console.log("Attempting to download job PDFs for product type:", productType);
      
      // Special handling for business cards - uses dedicated function
      if (productType === "Business Cards") {
        console.log("Using Business Cards specific download function");
        toast.loading("Preparing Business Card PDFs for download...");
        await downloadBatchJobPdfs(relatedJobs, batch.name);
        toast.success("Business card job PDFs downloaded successfully");
      } else {
        // Generic handling for other product types
        toast.error("PDF download not implemented for this product type yet");
      }
    } catch (error) {
      console.error("Error downloading job PDFs:", error);
      toast.error("Failed to download job PDFs");
    }
  };

  const handleDownloadBatchOverviewSheet = async () => {
    try {
      // Check if batch overview PDF URL exists
      const overviewPdfUrl = batch.overview_pdf_url;
      
      if (!overviewPdfUrl) {
        toast.error("No batch overview sheet available");
        return;
      }

      console.log("Downloading batch overview sheet:", overviewPdfUrl);
      toast.loading("Downloading batch overview sheet...");
      await handlePdfAction(overviewPdfUrl, 'download', `${batch.name}-overview.pdf`);
    } catch (error) {
      console.error("Error downloading batch overview sheet:", error);
      toast.error("Failed to download batch overview sheet");
    }
  };
  
  // Convert Job[] to BaseJob[] for FlyerBatchOverview - ensure job_number is passed directly
  const convertToBaseJobs = (jobs: Job[]): BaseJob[] => {
    return jobs.map(job => ({
      ...job,
      job_number: job.job_number,
      due_date: job.due_date || new Date().toISOString(),
      file_name: job.file_name || "",
      user_id: job.user_id || "",
      created_at: job.created_at || new Date().toISOString(),
    })) as BaseJob[];
  };
  
  return (
    <>
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <BatchDetailsCard 
          batch={batch}
          onDeleteClick={onDeleteClick}
          onStatusUpdate={onRefresh}
        />
        <BatchActionsCard 
          batch={batch} 
          onDownloadJobPdfs={handleDownloadJobPdfs}
          onDownloadBatchOverviewSheet={handleDownloadBatchOverviewSheet}
          productType={productType} 
        />
      </div>

      {/* Show Related Jobs for all product types */}
      {relatedJobs.length > 0 && (
        <>
          <RelatedJobsCard jobs={relatedJobs} />
          {/* Only show batch overview for Business Cards where it's fully implemented */}
          {productType === "Business Cards" && (
            <FlyerBatchOverview 
              jobs={convertToBaseJobs(relatedJobs)}
              batchName={batch.name}
            />
          )}
        </>
      )}
    </>
  );
};

export default BatchDetailsContent;
