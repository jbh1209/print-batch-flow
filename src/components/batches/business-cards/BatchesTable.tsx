
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, File, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { UrgencyLevel, calculateJobUrgency, getUrgencyBackgroundClass } from "@/utils/dateCalculations";
import { BaseBatch } from "@/config/productTypes";

interface BatchesTableProps {
  batches: BaseBatch[];
  isLoading?: boolean;
  onViewDetails: (batchId: string) => void;
  onViewPDF?: (pdfUrl: string) => void;
  onDeleteBatch?: (batchId: string) => void;
}

const BatchesTable: React.FC<BatchesTableProps> = ({
  batches,
  isLoading = false,
  onViewDetails,
  onViewPDF,
  onDeleteBatch,
}) => {
  // Calculate urgency level for a date
  const calculateUrgencyLevel = (dueDate: string): UrgencyLevel => {
    return calculateJobUrgency(dueDate);
  };

  // Format date to display format
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-amber-500 text-amber-500">Pending</Badge>;
      case "sent_to_print":
        return <Badge className="bg-purple-500">Sent to Print</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="h-24 text-center">
          <div className="flex justify-center items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span>Loading batches...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (batches.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="h-24 text-center">
          <p className="text-gray-500">No batches found</p>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {batches.map((batch) => {
        const urgency = calculateUrgencyLevel(batch.due_date);
        const bgClass = getUrgencyBackgroundClass(urgency);

        return (
          <TableRow key={batch.id} className={bgClass}>
            <TableCell className="font-medium">{batch.name}</TableCell>
            <TableCell>{batch.sheets_required}</TableCell>
            <TableCell>{formatDate(batch.due_date)}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {batch.lamination_type === "none"
                  ? "None"
                  : batch.lamination_type.charAt(0).toUpperCase() +
                    batch.lamination_type.slice(1)}
              </Badge>
            </TableCell>
            <TableCell>{getStatusBadge(batch.status)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(batch.id)}
                >
                  <Eye size={16} />
                </Button>
                {batch.front_pdf_url && onViewPDF && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewPDF(batch.front_pdf_url)}
                  >
                    <File size={16} />
                  </Button>
                )}
                {onDeleteBatch && batch.status !== "completed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => onDeleteBatch(batch.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
};

export default BatchesTable;
