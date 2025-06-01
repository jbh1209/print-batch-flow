
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
  QrCode,
  Download
} from "lucide-react";
import { QRLabelsManager } from "../QRLabelsManager";

interface JobsTableBulkActionsBarProps {
  selectedJobsCount: number;
  isDeleting: boolean;
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: (newStatus: string) => void | Promise<void>;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onCustomWorkflow: () => void;
  selectedJobs: any[];
}

export const JobsTableBulkActionsBar: React.FC<JobsTableBulkActionsBarProps> = ({
  selectedJobsCount,
  isDeleting,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkDelete,
  onClearSelection,
  onCustomWorkflow,
  selectedJobs
}) => {
  const [showQRLabels, setShowQRLabels] = React.useState(false);

  if (selectedJobsCount === 0) return null;

  const handleQRLabelsClick = () => {
    setShowQRLabels(true);
  };

  const handleStatusUpdate = () => {
    // For now, we'll update to "printing" status - this could be made configurable
    onBulkStatusUpdate("printing");
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
              <div className="flex gap-2">
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
                  onClick={handleQRLabelsClick}
                  className="flex items-center gap-1"
                >
                  <QrCode className="h-3 w-3" />
                  QR Labels PDF
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

      {/* QR Labels Manager Modal */}
      {showQRLabels && (
        <QRLabelsManager 
          selectedJobs={selectedJobs}
          onClose={() => setShowQRLabels(false)}
        />
      )}
    </>
  );
};
