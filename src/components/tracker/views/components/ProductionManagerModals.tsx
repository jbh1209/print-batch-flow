
import React from "react";
import { JobEditModal } from "@/components/tracker/jobs/JobEditModal";
import { CategoryAssignModal } from "@/components/tracker/jobs/CategoryAssignModal";
import { CustomWorkflowModal } from "@/components/tracker/jobs/CustomWorkflowModal";
import { BarcodeLabelsModal } from "@/components/tracker/QRLabelsManager";
import { useProductionJobs } from "@/contexts/ProductionJobsContext";

interface ProductionManagerModalsProps {
  categories: any[];
  onRefresh: () => Promise<void>;
}

export const ProductionManagerModals: React.FC<ProductionManagerModalsProps> = ({
  categories,
  onRefresh,
}) => {
  const {
    editingJob,
    setEditingJob,
    categoryAssignJob,
    setCategoryAssignJob,
    customWorkflowJob,
    setCustomWorkflowJob,
    showCustomWorkflow,
    setShowCustomWorkflow,
    showBarcodeLabels,
    setShowBarcodeLabels,
    selectedJobsForBarcodes,
    setSelectedJobsForBarcodes,
  } = useProductionJobs();

  const handleEditJobSave = async () => {
    setEditingJob(null);
    await onRefresh();
  };

  const handleCategoryAssignComplete = async () => {
    setCategoryAssignJob(null);
    await onRefresh();
  };

  const handleCustomWorkflowSuccess = async () => {
    setCustomWorkflowJob(null);
    setShowCustomWorkflow(false);
    await onRefresh();
  };

  return (
    <>
      {/* Edit Job Modal */}
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={handleEditJobSave}
        />
      )}

      {/* Category Assignment Modal */}
      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={handleCategoryAssignComplete}
        />
      )}

      {/* Custom Workflow Modal */}
      {showCustomWorkflow && customWorkflowJob && (
        <CustomWorkflowModal
          job={customWorkflowJob}
          isOpen={showCustomWorkflow}
          onClose={() => setShowCustomWorkflow(false)}
          onSuccess={handleCustomWorkflowSuccess}
        />
      )}

      {/* Barcode Labels Modal */}
      {showBarcodeLabels && (
        <BarcodeLabelsModal
          jobs={selectedJobsForBarcodes}
          isOpen={showBarcodeLabels}
          onClose={() => {
            setShowBarcodeLabels(false);
            setSelectedJobsForBarcodes([]);
          }}
        />
      )}
    </>
  );
};
