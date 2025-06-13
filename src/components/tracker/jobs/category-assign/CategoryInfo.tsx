
import React from "react";

interface CategoryInfoProps {
  selectedCategory: any;
  isLoading: boolean;
  hasMultiPartStages: boolean;
}

export const CategoryInfo: React.FC<CategoryInfoProps> = ({
  selectedCategory,
  isLoading,
  hasMultiPartStages
}) => {
  if (!selectedCategory) return null;

  return (
    <div className="p-3 bg-blue-50 rounded-lg">
      <p className="text-sm text-blue-700">
        <strong>Category:</strong> {selectedCategory.name}
      </p>
      <p className="text-sm text-blue-700">
        <strong>SLA:</strong> {selectedCategory.sla_target_days} days
      </p>
      {isLoading && (
        <p className="text-sm text-blue-600 mt-1">
          Checking for multi-part stages...
        </p>
      )}
      {!isLoading && hasMultiPartStages && (
        <p className="text-sm text-blue-600 mt-1">
          This category has multi-part stages. You'll be able to assign parts to specific stages.
        </p>
      )}
      {!isLoading && !hasMultiPartStages && (
        <p className="text-sm text-blue-600 mt-1">
          Workflow will be initialized with all stages in pending status.
        </p>
      )}
    </div>
  );
};
