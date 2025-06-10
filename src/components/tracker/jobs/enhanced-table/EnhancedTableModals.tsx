
import React from "react";
import { JobEditModal } from "../JobEditModal";
import { CategoryAssignModal } from "../CategoryAssignModal";
import { CustomWorkflowModal } from "../CustomWorkflowModal";

interface EnhancedTableModalsProps {
  editingJob: any;
  setEditingJob: (job: any) => void;
  categoryAssignJob: any;
  setCategoryAssignJob: (job: any) => void;
  showCustomWorkflow: boolean;
  setShowCustomWorkflow: (show: boolean) => void;
  customWorkflowJob: any;
  setCustomWorkflowJob: (job: any) => void;
  categories: any[];
  onEditJobSave: () => void;
  onCategoryAssignComplete: () => void;
  onCustomWorkflowSuccess: () => void;
}

export const EnhancedTableModals: React.FC<EnhancedTableModalsProps> = ({
  editingJob,
  setEditingJob,
  categoryAssignJob,
  setCategoryAssignJob,
  showCustomWorkflow,
  setShowCustomWorkflow,
  customWorkflowJob,
  setCustomWorkflowJob,
  categories,
  onEditJobSave,
  onCategoryAssignComplete,
  onCustomWorkflowSuccess
}) => {
  return (
    <>
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={onEditJobSave}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={onCategoryAssignComplete}
        />
      )}

      {showCustomWorkflow && customWorkflowJob && (
        <CustomWorkflowModal
          isOpen={showCustomWorkflow}
          onClose={() => {
            setShowCustomWorkflow(false);
            setCustomWorkflowJob(null);
          }}
          job={customWorkflowJob}
          onSuccess={onCustomWorkflowSuccess}
        />
      )}
    </>
  );
};
