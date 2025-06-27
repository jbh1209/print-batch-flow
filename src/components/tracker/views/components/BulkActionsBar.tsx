
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users,
  RotateCcw,
  X,
  Workflow,
  Barcode,
  CheckCircle,
  Trash2
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface BulkActionsBarProps {
  selectedJobs: AccessibleJob[];
  onBulkCategoryAssign: (selectedJobs: AccessibleJob[]) => void;
  onBulkStatusUpdate: (selectedJobs: AccessibleJob[], status: string) => void;
  onBulkMarkCompleted?: (selectedJobs: AccessibleJob[]) => void;
  onCustomWorkflow: (job: AccessibleJob) => void;
  onGenerateBarcodes: (selectedJobs: AccessibleJob[]) => void;
  onBulkDelete: (selectedJobs: AccessibleJob[]) => void;
  onClearSelection: () => void;
  isAdmin?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedJobs,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkMarkCompleted,
  onCustomWorkflow,
  onGenerateBarcodes,
  onBulkDelete,
  onClearSelection,
  isAdmin = false
}) => {
  if (selectedJobs.length === 0) return null;

  return (
    <div className="sticky top-0 z-50 bg-white pb-4">
      <Card className="border-blue-200 bg-blue-50 shadow-lg">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected
              </Badge>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onBulkCategoryAssign(selectedJobs)}
                  className="flex items-center gap-1"
                >
                  <Users className="h-3 w-3" />
                  Assign Category
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onBulkStatusUpdate(selectedJobs, "printing")}
                  className="flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Update Status
                </Button>
                {isAdmin && onBulkMarkCompleted && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onBulkMarkCompleted(selectedJobs)}
                    className="flex items-center gap-1 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Mark Completed
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onCustomWorkflow(selectedJobs[0])}
                  disabled={selectedJobs.length !== 1}
                  className="flex items-center gap-1"
                >
                  <Workflow className="h-3 w-3" />
                  Custom Workflow
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onGenerateBarcodes(selectedJobs)}
                  className="flex items-center gap-1"
                >
                  <Barcode className="h-3 w-3" />
                  Barcode Labels
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => onBulkDelete(selectedJobs)}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onClearSelection}
              className="flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear Selection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
