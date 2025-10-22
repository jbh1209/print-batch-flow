import React from "react";
import { PartMultiStageSelector } from "../../factory/PartMultiStageSelector";

interface PartsAssignmentStepProps {
  selectedCategory: any;
  availableParts: string[];
  multiPartStages: any[];
  partAssignments: Record<string, string>;
  onPartAssignmentsChange: (assignments: Record<string, string>) => void;
  autoAssignedParts?: string[];
}

export const PartsAssignmentStep: React.FC<PartsAssignmentStepProps> = ({
  selectedCategory,
  availableParts,
  multiPartStages,
  partAssignments,
  onPartAssignmentsChange,
  autoAssignedParts = []
}) => {
  return (
    <>
      <div className="p-3 bg-green-50 rounded-lg">
        <p className="text-sm text-green-700">
          <strong>Category:</strong> {selectedCategory?.name}
        </p>
        <p className="text-sm text-green-600 mt-1">
          Assign each part to the appropriate stage:
        </p>
      </div>

      <PartMultiStageSelector
        availableParts={availableParts}
        availableStages={multiPartStages}
        onPartAssignmentsChange={onPartAssignmentsChange}
        initialAssignments={partAssignments}
        autoAssignedParts={autoAssignedParts}
      />
    </>
  );
};
