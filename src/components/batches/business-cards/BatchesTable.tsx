
import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, FileText, Trash2 } from "lucide-react";
import { formatRelativeTime, formatDate } from "@/utils/dateUtils";
import { Badge } from "@/components/ui/badge";
import { BatchStatus } from "@/config/types/baseTypes";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { useAuth } from "@/hooks/useAuth";
import { canModifyRecord } from "@/utils/permissionUtils";

interface BatchesTableProps {
  batches: BatchSummary[];
  isLoading: boolean;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: (batchId: string) => void;
  onViewDetails?: (batchId: string) => void;
}

const BatchesTable = ({ 
  batches, 
  isLoading, 
  onViewPDF, 
  onDeleteBatch,
  onViewDetails
}: BatchesTableProps) => {
  const { user } = useAuth();

  const getBatchStatusBadge = (status: BatchStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'queued':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Queued</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Processing</Badge>;
      case 'sent_to_print':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Sent to Print</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewPDF = (e: React.MouseEvent, url: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    onViewPDF(url);
  };
  
  const handleDelete = (e: React.MouseEvent, batchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteBatch(batchId);
  };

  const handleViewDetails = (batchId: string) => {
    if (onViewDetails) {
      onViewDetails(batchId);
    }
  };

  return (
    <>
      {batches.map(batch => {
        // Make sure to handle potential undefined created_by
        const canModify = canModifyRecord(batch.created_by || "", user?.id);
        
        return (
          <TableRow 
            key={batch.id} 
            className="hover:bg-slate-50 cursor-pointer"
            onClick={() => handleViewDetails(batch.id)}
          >
            <TableCell>
              <div className="font-medium">{batch.name}</div>
              <div className="text-xs text-slate-500">{batch.product_type}</div>
              {!canModify && (
                <Badge variant="outline" className="mt-1 text-xs">
                  Read-only
                </Badge>
              )}
            </TableCell>
            <TableCell>
              {getBatchStatusBadge(batch.status as BatchStatus)}
            </TableCell>
            <TableCell>{batch.sheets_required}</TableCell>
            <TableCell>
              <div>{formatDate(batch.due_date)}</div>
              <div className="text-xs text-slate-500">{formatRelativeTime(batch.due_date)}</div>
            </TableCell>
            <TableCell>
              <div>{formatDate(batch.created_at)}</div>
              <div className="text-xs text-slate-500">{formatRelativeTime(batch.created_at)}</div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end space-x-1">
                {batch.front_pdf_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleViewPDF(e, batch.front_pdf_url)}
                    title="View Front PDF"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleViewDetails(batch.id)}
                  title="View Batch Details"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {canModify && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(e, batch.id)}
                    title="Delete Batch"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
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
