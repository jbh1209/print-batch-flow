
import React from "react";
import { Button } from "@/components/ui/button";

interface CategoryAssignModalActionsProps {
  currentStep: 'category' | 'parts';
  isAssigning: boolean;
  selectedCategoryId: string;
  isLoading: boolean;
  hasMultiPartStages: boolean;
  availableParts: string[];
  onBack: () => void;
  onClose: () => void;
  onNextStep: () => void;
  onAssignment: () => void;
}

export const CategoryAssignModalActions: React.FC<CategoryAssignModalActionsProps> = ({
  currentStep,
  isAssigning,
  selectedCategoryId,
  isLoading,
  hasMultiPartStages,
  availableParts,
  onBack,
  onClose,
  onNextStep,
  onAssignment
}) => {
  return (
    <div className="flex gap-2 justify-end">
      {currentStep === 'parts' && (
        <Button variant="outline" onClick={onBack} disabled={isAssigning}>
          Back
        </Button>
      )}
      <Button variant="outline" onClick={onClose} disabled={isAssigning}>
        Cancel
      </Button>
      {currentStep === 'category' && (
        <Button onClick={onNextStep} disabled={isAssigning || !selectedCategoryId || isLoading}>
          {hasMultiPartStages && availableParts.length > 0 ? "Next: Assign Parts" : "Assign Category"}
        </Button>
      )}
      {currentStep === 'parts' && (
        <Button onClick={onAssignment} disabled={isAssigning}>
          {isAssigning ? "Assigning..." : "Complete Assignment"}
        </Button>
      )}
    </div>
  );
};
