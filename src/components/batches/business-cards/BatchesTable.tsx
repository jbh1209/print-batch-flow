
import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Eye, Trash2, FileText } from "lucide-react";
import { BatchSummary } from "@/components/batches/types/BatchTypes";

interface BatchesTableProps {
  batches: BatchSummary[];
  isLoading: boolean;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: (batchId: string) => void;
  onViewDetails?: (batchId: string) => void; // Add this line to support viewing batch details
}

const BatchesTable = ({
  batches,
  isLoading,
  onViewPDF,
  onDeleteBatch,
  onViewDetails
}: BatchesTableProps) => {
  if (isLoading) {
    return <TableRow>
      <TableCell colSpan={6} className="text-center py-8">Loading batches...</TableCell>
    </TableRow>;
  }

  return (
    <>
      {batches.map((batch) => (
        <TableRow key={batch.id}>
          <TableCell>{batch.name}</TableCell>
          <TableCell>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
              batch.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : batch.status === 'processing'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
            </span>
          </TableCell>
          <TableCell>{batch.sheets_required}</TableCell>
          <TableCell>
            {format(new Date(batch.due_date), 'MMM d, yyyy')}
          </TableCell>
          <TableCell>
            {batch.created_at && format(new Date(batch.created_at), 'MMM d, yyyy')}
          </TableCell>
          <TableCell className="text-right space-x-2">
            {batch.front_pdf_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewPDF(batch.front_pdf_url)}
                title="View PDF"
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}
            
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(batch.id)}
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteBatch(batch.id)}
              title="Delete Batch"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};

export default BatchesTable;
