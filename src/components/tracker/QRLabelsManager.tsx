
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Download, Printer, FileText, Loader2, X } from "lucide-react";
import { downloadQRLabelsPDF, QRLabelData } from "@/utils/qrLabelGenerator";
import { toast } from "sonner";

interface QRLabelsManagerProps {
  selectedJobs: any[];
  onClose?: () => void;
}

export const QRLabelsManager: React.FC<QRLabelsManagerProps> = ({
  selectedJobs,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isOpen = selectedJobs.length > 0;

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const generateLabels = async () => {
    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for QR label generation");
      return;
    }

    setIsGenerating(true);
    try {
      const labelData: QRLabelData[] = selectedJobs.map(job => ({
        id: job.id,
        wo_no: job.wo_no,
        customer: job.customer,
        due_date: job.due_date,
        status: job.status,
        reference: job.reference
      }));

      await downloadQRLabelsPDF(labelData, `qr-labels-${selectedJobs.length}-jobs.pdf`);
      
      toast.success(`Successfully generated QR labels for ${selectedJobs.length} jobs`);
      handleClose();
    } catch (error) {
      console.error('Error generating QR labels:', error);
      toast.error('Failed to generate QR labels');
    } finally {
      setIsGenerating(false);
    }
  };

  const printLabels = () => {
    if (previewUrl) {
      const printWindow = window.open(previewUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } else {
      // Generate and then print
      generateLabels();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Labels Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Label Generation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Selected Jobs:</span>
                  <Badge variant="outline" className="text-sm">
                    {selectedJobs.length} jobs
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Label Size:</span>
                  <span className="text-sm text-gray-600">100mm × 50mm (1 per page)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Format:</span>
                  <span className="text-sm text-gray-600">PDF ({selectedJobs.length} pages)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Job Number Format:</span>
                  <span className="text-sm text-gray-600">D{selectedJobs[0]?.wo_no || 'XXXXX'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Selected Jobs Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-32 md:max-h-40 overflow-y-auto space-y-2">
                {selectedJobs.slice(0, 10).map((job) => (
                  <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm border rounded p-2 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">D{job.wo_no}</span>
                      <span className="text-gray-600 truncate">{job.customer || 'No customer'}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.status && (
                        <Badge variant="outline" className="text-xs">
                          {job.status}
                        </Badge>
                      )}
                      {job.due_date && (
                        <span className="text-xs text-gray-500">
                          Due: {new Date(job.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {selectedJobs.length > 10 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    +{selectedJobs.length - 10} more jobs
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Label Features */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Label Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>Job number with "D" prefix</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>QR code for mobile scanning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>Customer information</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>Due date and status</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>Reference information</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>Generation timestamp</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={printLabels}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Labels
            </Button>
            <Button
              onClick={generateLabels}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isGenerating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-800">Printing Instructions</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Labels are sized exactly 100mm × 50mm (1 per page)</li>
                  <li>• PDF contains one label per page for easy printing</li>
                  <li>• Use your label printer's Windows driver</li>
                  <li>• Apply labels to paper job tickets for factory scanning</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
