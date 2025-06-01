
import React from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CheckCircle } from "lucide-react";

interface JobsTableBulkActionsBarProps {
  selectedJobsCount: number;
  isDeleting: boolean;
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: (status: string) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export const JobsTableBulkActionsBar: React.FC<JobsTableBulkActionsBarProps> = ({
  selectedJobsCount,
  isDeleting,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkDelete,
  onClearSelection
}) => {
  if (selectedJobsCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-blue-900">
            {selectedJobsCount} job{selectedJobsCount > 1 ? 's' : ''} selected
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkCategoryAssign}
            disabled={isDeleting}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Assign Category
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusUpdate('Completed')}
            disabled={isDeleting}
            className="flex items-center gap-2 text-green-700 border-green-200 hover:bg-green-50"
          >
            <CheckCircle className="h-4 w-4" />
            Mark as Completed
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            disabled={isDeleting}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : `Delete ${selectedJobsCount} job${selectedJobsCount > 1 ? 's' : ''}`}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            disabled={isDeleting}
          >
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
};
