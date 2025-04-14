
import { CheckCircle2, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BatchDetailsType, BatchStatus } from "./types/BatchTypes";
import { handlePdfAction } from "@/utils/pdfActionUtils";

interface BatchActionsCardProps {
  batch: BatchDetailsType;
  handleViewPDF: (url: string | null) => void;
}

const BatchActionsCard = ({ batch, handleViewPDF }: BatchActionsCardProps) => {
  // Helper function to determine button text based on status
  const getButtonText = (status: BatchStatus) => {
    switch (status) {
      case "pending":
        return "Mark as Processing";
      case "processing":
        return "Mark as Completed";
      case "cancelled":
        return "Reactivate Batch";
      case "completed":
        return "Update Status";
      default:
        return "Update Status";
    }
  };

  // Check if the status is not completed
  const isNotCompleted = batch.status !== "completed";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Actions</CardTitle>
        <CardDescription>Manage your batch</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNotCompleted && (
          <Button 
            className="w-full flex items-center gap-2"
            variant={batch.status === "pending" ? "default" : "outline"}
            disabled={batch.status === "completed"}
          >
            <CheckCircle2 className="h-4 w-4" />
            {getButtonText(batch.status)}
          </Button>
        )}
        
        {(batch.front_pdf_url || batch.back_pdf_url) && (
          <div className="space-y-2">
            <p className="text-sm font-medium">PDFs</p>
            <div className="flex flex-col gap-2">
              {batch.front_pdf_url && (
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handlePdfAction(batch.front_pdf_url, 'view')}
                    className="flex items-center justify-start gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Imposition PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handlePdfAction(batch.front_pdf_url, 'download')}
                    className="flex items-center justify-start gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Imposition PDF
                  </Button>
                </div>
              )}
              {batch.back_pdf_url && (
                <div className="flex flex-col gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handlePdfAction(batch.back_pdf_url, 'view')}
                    className="flex items-center justify-start gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Overview PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handlePdfAction(batch.back_pdf_url, 'download')}
                    className="flex items-center justify-start gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Overview PDF
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BatchActionsCard;
