
import React from "react";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";

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
  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        <BatchDetailsCard 
          batch={batch}
          onDeleteClick={onDeleteClick} 
        />
        <BatchActionsCard batch={batch} />
      </div>

      {/* Related Jobs */}
      {productType === "Business Cards" && relatedJobs.length > 0 && (
        <RelatedJobsCard 
          jobs={relatedJobs} 
        />
      )}
    </>
  );
};

export default BatchDetailsContent;
