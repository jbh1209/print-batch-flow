
import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface JobsBulkActionsProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  isDeleting?: boolean;
}

export const JobsBulkActions: React.FC<JobsBulkActionsProps> = ({
  selectedCount,
  onBulkDelete,
  onClearSelection,
  isDeleting = false
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} job{selectedCount > 1 ? 's' : ''} selected
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            disabled={isDeleting}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : `Delete ${selectedCount} job${selectedCount > 1 ? 's' : ''}`}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            disabled={isDeleting}
          >
            <X className="h-4 w-4" />
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
};
