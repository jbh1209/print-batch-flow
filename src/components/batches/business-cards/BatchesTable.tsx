
import React from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Trash2, FileText } from "lucide-react";
import JobStatusBadge from "@/components/JobStatusBadge";
import { BatchSummary } from "@/components/batches/types/BatchTypes";

interface BatchesTableProps {
  batches: BatchSummary[];
  isLoading: boolean;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: (batchId: string) => void;
}

const BatchesTable = ({ 
  batches, 
  isLoading, 
  onViewPDF, 
  onDeleteBatch 
}: BatchesTableProps) => {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="h-24 text-center">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2">Loading batches...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (batches.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="h-24 text-center">
          <div className="flex flex-col items-center justify-center text-gray-500">
            <div className="bg-gray-100 rounded-full p-3 mb-3">
              <FileText size={24} className="text-gray-400" />
            </div>
            <h3 className="font-medium mb-1">No batches found</h3>
            <p className="text-sm mb-4">You haven't created any batches yet.</p>
            <Button onClick={() => navigate("/batches/business-cards/jobs")}>
              Create a Batch
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {batches.map((batch) => (
        <TableRow key={batch.id}>
          <TableCell className="font-medium">{batch.name}</TableCell>
          <TableCell>
            <JobStatusBadge status={batch.status} />
          </TableCell>
          <TableCell>{batch.sheets_required}</TableCell>
          <TableCell>{formatDate(batch.due_date)}</TableCell>
          <TableCell>{batch.created_at ? formatDate(batch.created_at) : 'N/A'}</TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              {batch.front_pdf_url && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onViewPDF(batch.front_pdf_url)}
                >
                  <Eye className="h-4 w-4" />
                  <span className="sr-only">View</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteBatch(batch.id)}
                disabled={batch.status === 'completed'}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};

export default BatchesTable;
