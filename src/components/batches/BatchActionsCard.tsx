
import { CheckCircle2, Download, Eye, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { BatchDetailsType, BatchStatus } from "./types/BatchTypes";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface BatchActionsCardProps {
  batch: BatchDetailsType;
}

const BatchActionsCard = ({ batch }: BatchActionsCardProps) => {
  const { user } = useAuth();
  
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
  
  // Check if PDFs are available and valid URLs
  const hasImpositionPDF = !!batch.front_pdf_url && typeof batch.front_pdf_url === 'string';
  const hasOverviewPDF = !!batch.back_pdf_url && typeof batch.back_pdf_url === 'string';
  const hasPDFs = hasImpositionPDF || hasOverviewPDF;

  const handleViewPdf = async (url: string | null, name: string) => {
    if (!url) {
      toast.error(`No ${name} PDF available`);
      return;
    }
    
    try {
      toast.loading(`Opening ${name}...`);
      await handlePdfAction(url, 'view', `${batch.name}-${name}.pdf`);
    } catch (error) {
      console.error(`Error viewing ${name} PDF:`, error);
      toast.error(`Error opening ${name} PDF`);
    }
  };

  const handleDownloadPdf = async (url: string | null, name: string) => {
    if (!url) {
      toast.error(`No ${name} PDF available`);
      return;
    }
    
    try {
      toast.loading(`Preparing ${name} for download...`);
      await handlePdfAction(url, 'download', `${batch.name}-${name}.pdf`);
    } catch (error) {
      console.error(`Error downloading ${name} PDF:`, error);
      toast.error(`Error downloading ${name} PDF`);
    }
  };

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
        
        {/* PDF Actions */}
        <div className="space-y-2">
          <p className="text-sm font-medium">PDFs</p>
          
          {!hasPDFs && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>No PDFs available for this batch</span>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            {/* Imposition PDF (front_pdf_url) */}
            {hasImpositionPDF && (
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleViewPdf(batch.front_pdf_url, 'imposition')}
                  className="flex items-center justify-start gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Imposition PDF
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleDownloadPdf(batch.front_pdf_url, 'imposition')}
                  className="flex items-center justify-start gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Imposition PDF
                </Button>
              </div>
            )}
            
            {/* Overview PDF (back_pdf_url) */}
            {hasOverviewPDF && (
              <div className="flex flex-col gap-2 mt-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleViewPdf(batch.back_pdf_url, 'overview')}
                  className="flex items-center justify-start gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Overview PDF
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleDownloadPdf(batch.back_pdf_url, 'overview')}
                  className="flex items-center justify-start gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Overview PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      {hasPDFs && (
        <CardFooter className="pt-0 flex flex-col items-start">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <p>PDFs are securely stored and require authentication to access</p>
          </div>
          {!user && (
            <p className="text-xs text-amber-600 mt-1">
              You must be logged in to access these files
            </p>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default BatchActionsCard;
