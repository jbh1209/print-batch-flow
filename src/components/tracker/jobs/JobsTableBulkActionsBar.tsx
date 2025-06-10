
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Trash2, 
  Users, 
  RotateCcw, 
  X, 
  Workflow, 
  Download,
  Barcode,
  CheckCircle
} from "lucide-react";
import { BarcodeLabelsManager } from "../BarcodeLabelsManager";

interface JobsTableBulkActionsBarProps {
  selectedJobsCount: number;
  isDeleting: boolean;
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: (newStatus: string) => void | Promise<void>;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onCustomWorkflow: () => void;
  selectedJobs: any[];
  onBulkMarkCompleted?: () => void;
  isAdmin?: boolean;
}

export const JobsTableBulkActionsBar: React.FC<JobsTableBulkActionsBarProps> = ({
  selectedJobsCount,
  isDeleting,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkDelete,
  onClearSelection,
  onCustomWorkflow,
  selectedJobs,
  onBulkMarkCompleted,
  isAdmin = false
}) => {
  const [showBarcodeLabels, setShowBarcodeLabels] = React.useState(false);

  // Don't render anything if no jobs are selected
  if (selectedJobsCount === 0) return null;

  const handleBarcodeLabelsClick = () => {
    setShowBarcodeLabels(true);
  };

  const handleStatusUpdate = () => {
    // For now, we'll update to "printing" status - this could be made configurable
    onBulkStatusUpdate("printing");
  };

  const handleBulkComplete = () => {
    if (onBulkMarkCompleted) {
      console.log("🎯 Invoking bulk mark completed from JobsTableBulkActionsBar");
      onBulkMarkCompleted();
    } else {
      console.warn("Bulk mark completed function not provided");
    }
  };

  return (
    <>
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {selectedJobsCount} job{selectedJobsCount > 1 ? 's' : ''} selected
              </Badge>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={onBulkCategoryAssign}
                  className="flex items-center gap-1"
                >
                  <Users className="h-3 w-3" />
                  Assign Category
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleStatusUpdate}
                  className="flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Update Status
                </Button>
                {onBulkMarkCompleted && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleBulkComplete}
                    className="flex items-center gap-1 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Mark Completed
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={onCustomWorkflow}
                  disabled={selectedJobsCount !== 1}
                  className="flex items-center gap-1"
                >
                  <Workflow className="h-3 w-3" />
                  Custom Workflow
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleBarcodeLabelsClick}
                  className="flex items-center gap-1"
                >
                  <Barcode className="h-3 w-3" />
                  Barcode Labels PDF
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={onBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
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

      {/* Barcode Labels Manager Modal */}
      {showBarcodeLabels && (
        <BarcodeLabelsManager 
          selectedJobs={selectedJobs}
          onClose={() => setShowBarcodeLabels(false)}
        />
      )}
    </>
  );
};
