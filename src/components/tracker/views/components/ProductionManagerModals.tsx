
import React from "react";
import { JobEditModal } from "@/components/tracker/jobs/JobEditModal";
import { CategoryAssignModal } from "@/components/tracker/jobs/CategoryAssignModal";
import { CustomWorkflowModal } from "@/components/tracker/jobs/CustomWorkflowModal";
import { BarcodeLabelsManager } from "@/components/tracker/BarcodeLabelsManager";
import JobPartAssignmentManager from "@/components/jobs/JobPartAssignmentManager";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface ProductionManagerModalsProps {
  editingJob: AccessibleJob | null;
  setEditingJob: (job: AccessibleJob | null) => void;
  categoryAssignJob: any;
  setCategoryAssignJob: (job: any) => void;
  showCustomWorkflow: boolean;
  setShowCustomWorkflow: (show: boolean) => void;
  customWorkflowJob: AccessibleJob | null;
  setCustomWorkflowJob: (job: AccessibleJob | null) => void;
  showBarcodeLabels: boolean;
  setShowBarcodeLabels: (show: boolean) => void;
  selectedJobsForBarcodes: AccessibleJob[];
  setSelectedJobsForBarcodes: (jobs: AccessibleJob[]) => void;
  showPartAssignment: boolean;
  setShowPartAssignment: (show: boolean) => void;
  partAssignmentJob: AccessibleJob | null;
  setPartAssignmentJob: (job: AccessibleJob | null) => void;
  categories: any[];
  onRefresh: () => void;
}

export const ProductionManagerModals: React.FC<ProductionManagerModalsProps> = ({
  editingJob,
  setEditingJob,
  categoryAssignJob,
  setCategoryAssignJob,
  showCustomWorkflow,
  setShowCustomWorkflow,
  customWorkflowJob,
  setCustomWorkflowJob,
  showBarcodeLabels,
  setShowBarcodeLabels,
  selectedJobsForBarcodes,
  setSelectedJobsForBarcodes,
  showPartAssignment,
  setShowPartAssignment,
  partAssignmentJob,
  setPartAssignmentJob,
  categories,
  onRefresh
}) => {
  return (
    <>
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={() => {
            setEditingJob(null);
            onRefresh();
          }}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={() => {
            setCategoryAssignJob(null);
            onRefresh();
          }}
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
          onSuccess={() => {
            setShowCustomWorkflow(false);
            setCustomWorkflowJob(null);
            onRefresh();
          }}
        />
      )}

      {showBarcodeLabels && (
        <BarcodeLabelsManager 
          selectedJobs={selectedJobsForBarcodes}
          onClose={() => {
            setShowBarcodeLabels(false);
            setSelectedJobsForBarcodes([]);
          }}
        />
      )}

      {showPartAssignment && partAssignmentJob && (
        <JobPartAssignmentManager
          jobId={partAssignmentJob.job_id}
          jobTableName="production_jobs"
          open={showPartAssignment}
          onClose={() => {
            setShowPartAssignment(false);
            setPartAssignmentJob(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
};
