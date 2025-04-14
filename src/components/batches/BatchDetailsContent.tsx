
import React from "react";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";
import { handlePdfAction } from "@/utils/pdfActionUtils";

interface BatchDetailsContentProps {
  batch: BatchDetailsType;
  relatedJobs: Job[];
  productType: string;
  onDeleteClick: () => void;
}

const BatchDetailsContent = ({ 
  batch, 
  relatedJobs, 
  productType,
  onDeleteClick 
}: BatchDetailsContentProps) => {
  
  const handleViewPDF = (url: string | null) => {
    if (url) {
      // Open PDF directly in a new tab
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        <BatchDetailsCard 
          batch={batch} 
          handleViewPDF={(url) => handleViewPDF(url)} 
          onDeleteClick={onDeleteClick} 
        />
        <BatchActionsCard 
          batch={batch} 
          handleViewPDF={(url) => handleViewPDF(url)} 
        />
      </div>

      {/* Related Jobs */}
      {productType === "Business Cards" && relatedJobs.length > 0 && (
        <RelatedJobsCard 
          jobs={relatedJobs} 
          handleViewPDF={(url) => window.open(url, '_blank')} 
        />
      )}
    </>
  );
};

export default BatchDetailsContent;
