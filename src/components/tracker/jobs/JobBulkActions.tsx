
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Tags, 
  FolderOpen,
  X
} from "lucide-react";

interface JobBulkActionsProps {
  selectedCount: number;
  onCategoryAssign: () => void;
  onBulkOperations: () => void;
  onQRLabels: () => void;
  onClearSelection: () => void;
}

export const JobBulkActions: React.FC<JobBulkActionsProps> = ({
  selectedCount,
  onCategoryAssign,
  onBulkOperations,
  onQRLabels,
  onClearSelection
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {selectedCount} selected
        </Badge>
        
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onCategoryAssign}
            className="flex items-center gap-1 text-xs"
          >
            <FolderOpen className="h-3 w-3" />
            Assign Category
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onBulkOperations}
            className="flex items-center gap-1 text-xs"
          >
            <Package className="h-3 w-3" />
            Bulk Actions
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onQRLabels}
            className="flex items-center gap-1 text-xs"
          >
            <Tags className="h-3 w-3" />
            QR Labels
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="flex items-center gap-1 text-xs"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};
