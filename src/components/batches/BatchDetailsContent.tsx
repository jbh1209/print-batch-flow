
import React from "react";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";
import { FlyerBatchOverview } from "../flyers/FlyerBatchOverview";
import { downloadBatchJobPdfs, downloadIndividualBatchJobPdfs } from "@/utils/pdf/batchJobPdfUtils";
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
      toast.error("No jobs available to download", {
        description: "This batch doesn't have any linked jobs yet"
      });
      return;
    }
    
    try {
      // Use the new combined PDF generator
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
    try {
      // Check if batch overview PDF URL exists
      const overviewPdfUrl = batch.overview_pdf_url || batch.back_pdf_url;
      
      if (!overviewPdfUrl) {
        toast.error("No batch overview sheet available", {
          description: "This batch doesn't have an overview PDF generated"
        });
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
  
  // Convert Job[] to BaseJob[] for FlyerBatchOverview with proper type casting
  const convertToBaseJobs = (jobs: Job[]): BaseJob[] => {
    // Explicitly cast to unknown first, then to BaseJob[] to avoid type errors
    return jobs.map(job => ({
      ...job,
      job_number: job.job_number || job.name, // Use job_number if available, otherwise use name
      updated_at: job.updated_at || new Date().toISOString(), // Add required fields from BaseJob
      user_id: job.user_id || ""
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
          onDownloadBatchOverviewSheet={handleDownloadBatchOverviewSheet}
        />
      </div>

      {/* Show Related Jobs for all product types */}
      {relatedJobs.length > 0 ? (
        <>
          <RelatedJobsCard jobs={relatedJobs} />
          <FlyerBatchOverview 
            jobs={convertToBaseJobs(relatedJobs)}
            batchName={batch.name}
          />
        </>
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
