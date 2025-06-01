
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

interface JobsTableBulkActionsBarProps {
  selectedJobsCount: number;
  isDeleting: boolean;
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: () => void;
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
                  onClick={onBulkStatusUpdate}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Labels PDF Generator
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQRLabels(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">Ready to generate PDF</p>
                    <p className="text-sm text-blue-700">
                      {selectedJobsCount} job{selectedJobsCount > 1 ? 's' : ''} selected for QR label generation
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowQRLabels(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Import and call the PDF generation function
                    import("@/utils/qrLabelGenerator").then(({ downloadQRLabelsPDF }) => {
                      const labelData = selectedJobs.map(job => ({
                        id: job.id,
                        wo_no: job.wo_no,
                        customer: job.customer,
                        due_date: job.due_date,
                        status: job.status || 'pending',
                        reference: job.reference || job.customer
                      }));
                      
                      downloadQRLabelsPDF(labelData, `qr-labels-${selectedJobsCount}-jobs.pdf`);
                      setShowQRLabels(false);
                    });
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Generate PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
