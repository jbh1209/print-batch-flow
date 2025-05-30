
import React from "react";
import { Button } from "@/components/ui/button";
import { Package, Tags } from "lucide-react";

interface JobSelectionControlsProps {
  selectedJobsCount: number;
  onBulkOperations: () => void;
  onQRLabels: () => void;
  onClearSelection: () => void;
}

export const JobSelectionControls: React.FC<JobSelectionControlsProps> = ({
  selectedJobsCount,
  onBulkOperations,
  onQRLabels,
  onClearSelection
}) => {
  if (selectedJobsCount === 0) return null;

  return (
    <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <span className="text-sm font-medium text-blue-800">
        {selectedJobsCount} jobs selected
      </span>
      <Button
        size="sm"
        onClick={onBulkOperations}
        className="flex items-center gap-2"
      >
        <Package className="h-4 w-4" />
        Bulk Operations
      </Button>
      <Button
        size="sm"
        onClick={onQRLabels}
        className="flex items-center gap-2"
        variant="outline"
      >
        <Tags className="h-4 w-4" />
        QR Labels ({selectedJobsCount})
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onClearSelection}
      >
        Clear Selection
      </Button>
    </div>
  );
};
