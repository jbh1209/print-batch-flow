
import { format } from "date-fns";
import { Layers, CalendarIcon, Clock, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <CardFooter className="flex justify-between">
        {batch.status !== 'completed' && (
          <Button
            variant="destructive"
            onClick={onDeleteClick}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Batch
          </Button>
        )}
        <div className="flex gap-2">
          {batch.front_pdf_url && (
            <Button 
              variant="outline" 
              onClick={() => handleViewPDF(batch.front_pdf_url)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Front PDF
            </Button>
          )}
          {batch.back_pdf_url && (
            <Button 
              variant="outline" 
              onClick={() => handleViewPDF(batch.back_pdf_url)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Back PDF
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default BatchDetailsCard;
