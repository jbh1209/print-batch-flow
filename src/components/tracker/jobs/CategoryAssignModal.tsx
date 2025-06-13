
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CategoryAssignModalHeader } from "./category-assign/CategoryAssignModalHeader";
import { OrphanedJobsAlert } from "./category-assign/OrphanedJobsAlert";
import { CategorySelection } from "./category-assign/CategorySelection";
import { CategoryInfo } from "./category-assign/CategoryInfo";
import { PartsAssignmentStep } from "./category-assign/PartsAssignmentStep";
import { CategoryAssignModalActions } from "./category-assign/CategoryAssignModalActions";
import { useCategoryAssignLogic } from "./category-assign/useCategoryAssignLogic";
import { handleAssignment } from "./category-assign/categoryAssignmentLogic";

interface CategoryAssignModalProps {
  job: any;
  categories: any[];
  onClose: () => void;
  onAssign: () => void;
}

export const CategoryAssignModal: React.FC<CategoryAssignModalProps> = ({
  job,
  categories,
  onClose,
  onAssign
}) => {
  const {
    selectedCategoryId,
    currentStep,
    partAssignments,
    isAssigning,
    orphanedJobs,
    availableParts,
    multiPartStages,
    hasMultiPartStages,
    isLoading,
    handleRepairWorkflow,
    handleCategorySelect,
    handleNextStep,
    handlePartAssignmentsChange,
    handleBack,
    setIsAssigning
  } = useCategoryAssignLogic(job, onAssign, onClose);

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  const onHandleAssignment = () => {
    handleAssignment(
      job,
      selectedCategoryId,
      hasMultiPartStages,
      availableParts,
      partAssignments,
      setIsAssigning,
      onAssign,
      onClose
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <CategoryAssignModalHeader currentStep={currentStep} job={job} />

        <div className="space-y-4">
          <OrphanedJobsAlert
            orphanedJobs={orphanedJobs}
            isAssigning={isAssigning}
            onRepairWorkflow={handleRepairWorkflow}
          />

          {currentStep === 'category' && (
            <>
              <CategorySelection
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={handleCategorySelect}
              />

              <CategoryInfo
                selectedCategory={selectedCategory}
                isLoading={isLoading}
                hasMultiPartStages={hasMultiPartStages}
              />
            </>
          )}

          {currentStep === 'parts' && (
            <PartsAssignmentStep
              selectedCategory={selectedCategory}
              availableParts={availableParts}
              multiPartStages={multiPartStages}
              partAssignments={partAssignments}
              onPartAssignmentsChange={handlePartAssignmentsChange}
            />
          )}

          <CategoryAssignModalActions
            currentStep={currentStep}
            isAssigning={isAssigning}
            selectedCategoryId={selectedCategoryId}
            isLoading={isLoading}
            hasMultiPartStages={hasMultiPartStages}
            availableParts={availableParts}
            onBack={handleBack}
            onClose={onClose}
            onNextStep={handleNextStep}
            onAssignment={onHandleAssignment}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
