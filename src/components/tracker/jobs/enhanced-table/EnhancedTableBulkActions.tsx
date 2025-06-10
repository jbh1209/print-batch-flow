
import React from "react";
import { BulkDeleteHandler } from "../BulkDeleteHandler";
import { JobsTableBulkActionsBar } from "../JobsTableBulkActionsBar";

interface EnhancedTableBulkActionsProps {
  selectedJobs: string[];
  normalizedJobs: any[];
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: (status: string) => void;
  onBulkMarkCompleted?: () => void;
  onDeleteComplete: () => void;
  onClearSelection: () => void;
  onCustomWorkflow: () => void;
}

export const EnhancedTableBulkActions: React.FC<EnhancedTableBulkActionsProps> = ({
  selectedJobs,
  normalizedJobs,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkMarkCompleted,
  onDeleteComplete,
  onClearSelection,
  onCustomWorkflow
}) => {
  return (
    <BulkDeleteHandler
      selectedJobs={selectedJobs}
      onDeleteComplete={onDeleteComplete}
    >
      {({ onShowDialog }) => (
        <JobsTableBulkActionsBar
          selectedJobsCount={selectedJobs.length}
          isDeleting={false}
          onBulkCategoryAssign={onBulkCategoryAssign}
          onBulkStatusUpdate={onBulkStatusUpdate}
          onBulkMarkCompleted={onBulkMarkCompleted}
          onBulkDelete={onShowDialog}
          onClearSelection={onClearSelection}
          onCustomWorkflow={onCustomWorkflow}
          selectedJobs={normalizedJobs.filter(job => selectedJobs.includes(job.id))}
        />
      )}
    </BulkDeleteHandler>
  );
};
