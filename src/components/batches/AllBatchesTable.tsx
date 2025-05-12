
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, File, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { UrgencyLevel, getUrgencyBackgroundClass } from "@/utils/dateCalculations";
import { BatchSummary } from "./types/BatchTypes";

interface AllBatchesTableProps {
  batches: BatchSummary[];
  onViewDetails: (batchId: string) => void;
  onViewPDF?: (pdfUrl: string) => void;
  onDeleteBatch?: (batchId: string) => void;
}

const AllBatchesTable: React.FC<AllBatchesTableProps> = ({
  batches,
  onViewDetails,
  onViewPDF,
  onDeleteBatch,
}) => {
  // Function to determine row background color based on urgency
  const getRowBackgroundColor = (dueDate: string): string => {
    const urgency = calculateUrgency(dueDate);
    return getUrgencyBackgroundClass(urgency);
  };

  // Calculate urgency level for a date
  const calculateUrgency = (dueDate: string): UrgencyLevel => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "critical";
    } else if (diffDays <= 2) {
      return "high";
    } else if (diffDays <= 5) {
      return "medium";
    } else {
      return "low";
    }
  };

  // Format date to display format
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (e) {
      return dateString;
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "sent_to_print":
        return <Badge className="bg-purple-500">Sent to Print</Badge>;
      default:
        return <Badge className="bg-amber-500">Pending</Badge>;
    }
  };

  if (batches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No batches found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Sheets</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id} className={getRowBackgroundColor(batch.due_date)}>
              <TableCell>{batch.name}</TableCell>
              <TableCell>{batch.product_type}</TableCell>
              <TableCell>{formatDate(batch.due_date)}</TableCell>
              <TableCell>{batch.sheets_required}</TableCell>
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
                      onClick={() => onViewPDF(batch.front_pdf_url!)}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AllBatchesTable;
