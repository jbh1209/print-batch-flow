
import React from "react";
import { BatchDetailsType, Job } from "./types/BatchTypes";
import BatchDetailsCard from "./BatchDetailsCard";
import BatchActionsCard from "./BatchActionsCard";
import RelatedJobsCard from "./RelatedJobsCard";
import { FlyerBatchOverview } from "../flyers/FlyerBatchOverview";
import { BatchOverviewGenerator } from "./BatchOverviewGenerator";
import { useBatchPdfDownloads } from "./BatchPdfDownloads";

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
  const { convertToBaseJobs } = BatchOverviewGenerator({ 
    batch, 
    relatedJobs, 
    onRefresh 
  });

  const {
    handleDownloadJobPdfs,
    handleDownloadIndividualJobPdfs,
    handleDownloadBatchOverviewSheet
  } = useBatchPdfDownloads({ 
    batch, 
    relatedJobs, 
    convertToBaseJobs 
  });
  
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
