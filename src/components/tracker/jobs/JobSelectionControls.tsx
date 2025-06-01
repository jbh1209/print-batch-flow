
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Tags, CheckCircle, QrCode, Trash2, X } from "lucide-react";

interface JobSelectionControlsProps {
  selectedJobsCount: number;
  onBulkOperations: () => void;
  onQRLabels: () => void;
  onClearSelection: () => void;
  onCustomWorkflow?: () => void;
}

export const JobSelectionControls: React.FC<JobSelectionControlsProps> = ({
  selectedJobsCount,
  onBulkOperations,
  onQRLabels,
  onClearSelection,
  onCustomWorkflow
}) => {
  if (selectedJobsCount === 0) return null;

  const isSingleJob = selectedJobsCount === 1;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {selectedJobsCount} job{selectedJobsCount > 1 ? 's' : ''} selected
          </Badge>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkOperations}
              className="flex items-center gap-2"
            >
              <Tags className="h-4 w-4" />
              Assign Category
            </Button>

            {isSingleJob && onCustomWorkflow && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCustomWorkflow}
                className="flex items-center gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <Settings className="h-4 w-4" />
                Custom Workflow
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onQRLabels}
              className="flex items-center gap-2"
            >
              <QrCode className="h-4 w-4" />
              QR Labels
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <X className="h-4 w-4" />
          Clear Selection
        </Button>
      </div>
    </div>
  );
};
