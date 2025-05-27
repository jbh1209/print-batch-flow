
import { toast } from "sonner";
import { downloadBatchJobPdfs, downloadIndividualBatchJobPdfs } from "@/utils/pdf/batchJobPdfUtils";
import { generateBatchOverview } from "@/utils/batchGeneration";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { Job, BatchDetailsType } from "./types/BatchTypes";
import { BaseJob } from "@/config/productTypes";

interface BatchPdfDownloadsProps {
  batch: BatchDetailsType;
  relatedJobs: Job[];
  convertToBaseJobs: (jobs: Job[]) => BaseJob[];
}

export const useBatchPdfDownloads = ({ 
  batch, 
  relatedJobs, 
  convertToBaseJobs 
}: BatchPdfDownloadsProps) => {
  
  const handleDownloadJobPdfs = async () => {
    if (relatedJobs.length === 0) {
      toast.error("No jobs available to download", {
        description: "This batch doesn't have any linked jobs yet"
      });
      return;
    }
    
    try {
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
      await downloadIndividualBatchJobPdfs(relatedJobs, batch.name);
    } catch (error) {
      console.error("Error downloading individual job PDFs:", error);
      toast.error("Failed to download individual job PDFs");
    }
  };

  const handleDownloadBatchOverviewSheet = async () => {
    let toastId: string | number | undefined;
    
    try {
      // FORCE FRESH PDF GENERATION - Always generate new PDF to ensure updated layout
      if (relatedJobs.length > 0) {
        console.log("=== FORCING FRESH PDF GENERATION FOR DOWNLOAD ===");
        console.log("Batch object:", batch);
        console.log("Batch.sheets_required:", batch.sheets_required);
        console.log("Generating fresh overview with corrected layout and sheets_required:", batch.sheets_required);
        
        toastId = toast.loading("Generating batch overview sheet...");
        
        // Add cache-busting timestamp
        const timestamp = Date.now();
        console.log("Cache-busting timestamp for fresh PDF generation:", timestamp);
        
        // CRITICAL: Always use fresh generateBatchOverview function with updated layout
        const pdfBytes = await generateBatchOverview(
          convertToBaseJobs(relatedJobs),
          batch.name,
          batch.sheets_required || 0  // Ensure we pass the sheets_required value
        );
        
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${batch.name}-overview-${timestamp}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if (toastId) {
          toast.dismiss(toastId);
        }
        toast.success("Batch overview sheet downloaded successfully");
        return;
      } else {
        toast.error("No batch overview sheet available", {
          description: "This batch doesn't have jobs to generate an overview"
        });
        return;
      }
      
    } catch (error) {
      console.error("Error downloading batch overview sheet:", error);
      
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.error("Failed to download batch overview sheet");
    }
  };

  return {
    handleDownloadJobPdfs,
    handleDownloadIndividualJobPdfs,
    handleDownloadBatchOverviewSheet
  };
};
