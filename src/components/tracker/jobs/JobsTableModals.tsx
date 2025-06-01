
import React from "react";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { WorkflowInitModal } from "./WorkflowInitModal";
import { BulkJobOperations } from "./BulkJobOperations";
import { QRLabelsManager } from "../QRLabelsManager";

interface JobsTableModalsProps {
  editingJob: any;
  categoryAssignJob: any;
  workflowInitJob: any;
  showBulkOperations: boolean;
  showQRLabels: boolean;
  selectedJobs: any[];
  categories: any[];
  onCloseEditJob: () => void;
  onCloseCategoryAssign: () => void;
  onCloseWorkflowInit: () => void;
  onCloseBulkOperations: () => void;
  onCloseQRLabels: () => void;
  onEditJobSave: () => void;
  onCategoryAssignComplete: () => void;
  onWorkflowInitialize: (job: any, categoryId: string) => void;
  onOperationComplete: () => void;
}

export const JobsTableModals: React.FC<JobsTableModalsProps> = ({
  editingJob,
  categoryAssignJob,
  workflowInitJob,
  showBulkOperations,
  showQRLabels,
  selectedJobs,
  categories,
  onCloseEditJob,
  onCloseCategoryAssign,
  onCloseWorkflowInit,
  onCloseBulkOperations,
  onCloseQRLabels,
  onEditJobSave,
  onCategoryAssignComplete,
  onWorkflowInitialize,
  onOperationComplete
}) => {
  return (
    <>
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={onCloseEditJob}
          onSave={onEditJobSave}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={onCloseCategoryAssign}
          onAssign={onCategoryAssignComplete}
        />
      )}

      {workflowInitJob && (
        <WorkflowInitModal
          job={workflowInitJob}
          categories={categories}
          onClose={onCloseWorkflowInit}
          onInitialize={onWorkflowInitialize}
        />
      )}

      <BulkJobOperations
        isOpen={showBulkOperations}
        onClose={onCloseBulkOperations}
        selectedJobs={selectedJobs}
        categories={categories}
        onOperationComplete={onOperationComplete}
      />

      {showQRLabels && (
        <QRLabelsManager
          selectedJobs={selectedJobs}
          onClose={onCloseQRLabels}
        />
      )}
    </>
  );
};
