
import React from "react";
import { Download } from "lucide-react";
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
import { downloadBatchJobPdfs, downloadIndividualBatchJobPdfs } from "@/utils/pdf/batchJobPdfUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BatchActionsCardProps {
  batch: BatchDetailsType;
  onDownloadJobPdfs?: () => Promise<void>;
  onDownloadBatchOverviewSheet?: () => Promise<void>;
  onDownloadIndividualJobPdfs?: () => Promise<void>;
}

const BatchActionsCard = ({ 
  batch, 
  onDownloadJobPdfs, 
  onDownloadBatchOverviewSheet,
  onDownloadIndividualJobPdfs
}: BatchActionsCardProps) => {
  const handleDownloadFrontPdf = async () => {
    if (!batch.front_pdf_url) {
      toast.error("No front PDF available for this batch");
      return;
    }
    
    let toastId: string | number | undefined;
    
    try {
      toastId = toast.loading("Downloading batch front PDF...");
      await handlePdfAction(batch.front_pdf_url, 'download', `${batch.name}-front.pdf`);
      
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.success("Front PDF downloaded successfully");
    } catch (error) {
      console.error(`Error downloading front PDF for batch ${batch.id}:`, error);
      
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.error("Error downloading batch front PDF");
    }
  };

  const handleDownloadBackPdf = async () => {
    if (!batch.back_pdf_url) {
      toast.error("No back PDF available for this batch");
      return;
    }
    
    let toastId: string | number | undefined;
    
    try {
      toastId = toast.loading("Downloading batch back PDF...");
      await handlePdfAction(batch.back_pdf_url, 'download', `${batch.name}-back.pdf`);
      
      if (toastId) {
        toast.dismiss(toastId);
      }
      toast.success("Back PDF downloaded successfully");
    } catch (error) {
      console.error(`Error downloading back PDF for batch ${batch.id}:`, error);
      
      if (toastId) {
        toast.dismiss(toastId);
      }
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
          {/* Front PDF Download */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Front PDF</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadFrontPdf}
                disabled={!batch.front_pdf_url}
                className="w-full flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Front PDF
              </Button>
            </div>
          </div>
          
          {/* Back PDF Download (if back PDF exists) */}
          {batch.back_pdf_url && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Back PDF</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadBackPdf}
                  className="w-full flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Back PDF
                </Button>
              </div>
            </div>
          )}
          
          {/* Batch Overview Sheet Download */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-medium">Batch Overview</h3>
            <Button
              variant="default"
              size="sm"
              onClick={onDownloadBatchOverviewSheet}
              className="w-full flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Batch Overview Sheet
            </Button>
          </div>
          
          {/* Job PDFs Download */}
          <div className="space-y-2 border-t border-gray-200 pt-2">
            <h3 className="text-sm font-medium">Job PDFs</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Job PDFs
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuItem 
                    onClick={onDownloadJobPdfs}
                  >
                    Combined PDF (Imposition Format)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDownloadIndividualJobPdfs}
                  >
                    Individual Job PDFs (ZIP)
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BatchActionsCard;
