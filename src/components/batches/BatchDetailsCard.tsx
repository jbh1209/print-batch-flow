
import { format } from "date-fns";
import { Layers, CalendarIcon, Clock, Eye, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import JobStatusBadge from "@/components/JobStatusBadge";
import { BatchDetailsType } from "./types/BatchTypes";

interface BatchDetailsCardProps {
  batch: BatchDetailsType;
  handleViewPDF: (url: string | null) => void;
  onDeleteClick: () => void;
}

const BatchDetailsCard = ({ batch, handleViewPDF, onDeleteClick }: BatchDetailsCardProps) => {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const handlePdfAction = (url: string | null, action: 'view' | 'download') => {
    if (!url) {
      toast.error("PDF URL is not available");
      return;
    }

    try {
      if (action === 'view') {
        // Open in a new tab
        window.open(url, '_blank');
      } else {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = url;
        link.download = url.split('/').pop() || 'batch-pdf.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error handling PDF:", error);
      toast.error("Failed to process PDF. Please try again.");
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-batchflow-primary" />
          {batch.name}
        </CardTitle>
        <CardDescription>
          Batch Details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Status</p>
            <div>
              <JobStatusBadge status={batch.status} />
            </div>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Lamination Type</p>
            <p>{batch.lamination_type === 'none' ? 'None' : 
              batch.lamination_type.charAt(0).toUpperCase() + batch.lamination_type.slice(1)}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Sheets Required</p>
            <p>{batch.sheets_required}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Due Date</p>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              <p>{formatDate(batch.due_date)}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Created</p>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <p>{formatDate(batch.created_at)}</p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-4">
        {batch.status !== 'completed' && (
          <Button
            variant="destructive"
            onClick={onDeleteClick}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            Delete Batch
          </Button>
        )}
        <div className="flex flex-wrap gap-2 ml-auto">
          {batch.front_pdf_url && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => handlePdfAction(batch.front_pdf_url, 'view')}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View Imposition PDF
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handlePdfAction(batch.front_pdf_url, 'download')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Imposition PDF
              </Button>
            </div>
          )}
          {batch.back_pdf_url && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => handlePdfAction(batch.back_pdf_url, 'view')}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View Overview PDF
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handlePdfAction(batch.back_pdf_url, 'download')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Overview PDF
              </Button>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default BatchDetailsCard;
