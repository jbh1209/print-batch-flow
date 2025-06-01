
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Download, Printer, FileText, Loader2 } from "lucide-react";
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
      console.log("Starting PDF generation for", selectedJobs.length, "jobs");
      console.log("Function being called: downloadQRLabelsPDF");
      
      const labelData: QRLabelData[] = selectedJobs.map(job => ({
        id: job.id,
        wo_no: job.wo_no,
        customer: job.customer,
        due_date: job.due_date,
        status: job.status,
        reference: job.reference
      }));

      console.log("Label data prepared:", labelData);
      console.log("About to call downloadQRLabelsPDF...");
      
      // EXPLICITLY call the PDF generation function
      const result = await downloadQRLabelsPDF(labelData, `qr-labels-${selectedJobs.length}-jobs.pdf`);
      
      console.log("PDF generation result:", result);
      
      toast.success(`Successfully generated QR labels PDF for ${selectedJobs.length} jobs`);
      handleClose();
    } catch (error) {
      console.error('Error generating QR labels PDF:', error);
      toast.error('Failed to generate QR labels PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Labels PDF Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">PDF Generation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Selected Jobs:</span>
                  <Badge variant="outline">
                    {selectedJobs.length} jobs
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Label Size:</span>
                  <span className="text-sm text-gray-600">100mm × 50mm</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Layout:</span>
                  <span className="text-sm text-gray-600">1 label per page</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Output:</span>
                  <span className="text-sm text-gray-600">Multi-page PDF ({selectedJobs.length} pages)</span>
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
              <div className="max-h-40 overflow-y-auto space-y-2">
                {selectedJobs.slice(0, 10).map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-sm border rounded p-2">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {job.wo_no.startsWith('D') ? job.wo_no : `D${job.wo_no}`}
                      </span>
                      <span className="text-gray-600 truncate">{job.customer || 'No customer'}</span>
                    </div>
                    <div className="flex items-center gap-2">
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
              <CardTitle className="text-sm font-medium">PDF Label Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Order number with "D" prefix</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Centered QR code (25mm)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Customer information</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Due date when available</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Cancel
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
              {isGenerating ? 'Generating PDF...' : 'Download PDF'}
            </Button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-800">PDF Printing Instructions</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Multi-page PDF with {selectedJobs.length} label{selectedJobs.length > 1 ? 's' : ''}</li>
                  <li>• Each page contains one 100mm × 50mm label</li>
                  <li>• Print at 100% scale (no scaling)</li>
                  <li>• Use label stock or cut to size after printing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
