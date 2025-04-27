import React from "react";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";
import { FlyerBatchOverview } from "../flyers/FlyerBatchOverview";
import { downloadBatchJobPdfs } from "@/utils/pdf/batchJobPdfUtils";
import { toast } from "sonner";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { BaseJob } from "@/config/productTypes";

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
      await downloadBatchJobPdfs(relatedJobs, batch.name);
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
  
  // Convert Job[] to BaseJob[] for FlyerBatchOverview
  const convertToBaseJobs = (jobs: Job[]): BaseJob[] => {
    return jobs.map(job => ({
      ...job,
      job_number: job.name, // Use name as job_number
      due_date: new Date().toISOString(), // Default due_date
      file_name: job.name, // Use name as file_name
      user_id: "", // Default user_id
      created_at: new Date().toISOString(), // Default created_at
    })) as BaseJob[];
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
          onDownloadBatchOverviewSheet={handleDownloadBatchOverviewSheet}
        />
      </div>

      {/* Show Related Jobs for all product types */}
      {relatedJobs.length > 0 && (
        <>
          <RelatedJobsCard jobs={relatedJobs} />
          <FlyerBatchOverview 
            jobs={convertToBaseJobs(relatedJobs)}
            batchName={batch.name}
          />
        </>
      )}
    </>
  );
};

export default BatchDetailsContent;
