
import React from "react";
import { Package } from "lucide-react";
import { EnhancedJobsList } from "./EnhancedJobsList";

interface FilteredJobsViewProps {
  jobs: any[];
  selectedStage?: string;
  isLoading?: boolean;
  onStageAction?: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
}

export const FilteredJobsView: React.FC<FilteredJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onStageAction
}) => {
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-6 text-center">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
        <p className="text-gray-500">
          {selectedStage 
            ? `No jobs currently in the ${selectedStage} stage.`
            : 'No jobs match the current filters.'}
        </p>
      </div>
    );
  }

  return (
    <EnhancedJobsList
      jobs={jobs}
      selectedStage={selectedStage}
      isLoading={isLoading}
      onStageAction={onStageAction}
    />
  );
};
