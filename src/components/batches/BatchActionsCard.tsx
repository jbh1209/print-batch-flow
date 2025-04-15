
import React from "react";
import { Download, Printer, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { toast } from "sonner";
import { BatchDetailsType } from "./types/BatchTypes";
import { downloadBatchJobPdfs } from "@/utils/pdf/batchJobPdfUtils";

interface BatchActionsCardProps {
  batch: BatchDetailsType;
  onDownloadJobPdfs?: () => Promise<void>;
}

const BatchActionsCard = ({ batch, onDownloadJobPdfs }: BatchActionsCardProps) => {
  const handleViewFrontPdf = async () => {
    if (!batch.front_pdf_url) {
      toast.error("No front PDF available for this batch");
      return;
    }
    
    try {
      toast.loading("Opening batch front PDF...");
      await handlePdfAction(batch.front_pdf_url, 'view', `${batch.name}-front.pdf`);
    } catch (error) {
      console.error(`Error viewing front PDF for batch ${batch.id}:`, error);
      toast.error("Error opening batch front PDF");
    }
  };

  const handleViewBackPdf = async () => {
    if (!batch.back_pdf_url) {
      toast.error("No back PDF available for this batch");
      return;
    }
    
    try {
      toast.loading("Opening batch back PDF...");
      await handlePdfAction(batch.back_pdf_url, 'view', `${batch.name}-back.pdf`);
    } catch (error) {
      console.error(`Error viewing back PDF for batch ${batch.id}:`, error);
      toast.error("Error opening batch back PDF");
    }
  };

  const handleDownloadFrontPdf = async () => {
    if (!batch.front_pdf_url) {
      toast.error("No front PDF available for this batch");
      return;
    }
    
    try {
      toast.loading("Downloading batch front PDF...");
      await handlePdfAction(batch.front_pdf_url, 'download', `${batch.name}-front.pdf`);
    } catch (error) {
      console.error(`Error downloading front PDF for batch ${batch.id}:`, error);
      toast.error("Error downloading batch front PDF");
    }
  };

  const handleDownloadBackPdf = async () => {
    if (!batch.back_pdf_url) {
      toast.error("No back PDF available for this batch");
      return;
    }
    
    try {
      toast.loading("Downloading batch back PDF...");
      await handlePdfAction(batch.back_pdf_url, 'download', `${batch.name}-back.pdf`);
    } catch (error) {
      console.error(`Error downloading back PDF for batch ${batch.id}:`, error);
      toast.error("Error downloading batch back PDF");
    }
  };

  return (
    <Card className="md:col-span-1">
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Batch PDFs and options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Front PDF</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewFrontPdf}
                disabled={!batch.front_pdf_url}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadFrontPdf}
                disabled={!batch.front_pdf_url}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
          
          {/* Only show back PDF section if there is a back PDF URL or it's a double-sided job */}
          {batch.back_pdf_url && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Back PDF</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewBackPdf}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadBackPdf}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
          
          {/* Download Job PDFs */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-medium">Job PDFs</h3>
            <Button
              variant="default"
              size="sm"
              onClick={onDownloadJobPdfs}
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download All Job PDFs
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BatchActionsCard;
