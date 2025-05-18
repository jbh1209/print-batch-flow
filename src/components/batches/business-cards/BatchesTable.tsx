import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BatchWithJobs } from '../types/BusinessCardTypes';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Edit, Eye, Trash2 } from 'lucide-react';
import { deleteBatch } from '@/integrations/supabase/batches';
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/utils/dateUtils";
import { Badge } from "@/components/ui/badge";
import { calculateJobUrgency, getBatchUrgencyColor, getBatchUrgencyIcon } from '@/utils/dateCalculations';
import { productConfigs } from '@/config/productTypes';

interface BatchesTableProps {
  batches: BatchWithJobs[] | null;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

const BatchesTable: React.FC<BatchesTableProps> = ({
  batches,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBatch = async (batchId: string) => {
    if (window.confirm("Are you sure you want to delete this batch?")) {
      setIsDeleting(true);
      setDeletingBatchId(batchId);
      try {
        await deleteBatch(batchId);
        toast({
          title: "Batch deleted successfully.",
        });
        onRefresh(); // Refresh batches
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error deleting batch.",
          description: error.message,
        });
      } finally {
        setIsDeleting(false);
        setDeletingBatchId(null);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="w-full">
      <Table>
        <TableCaption>
          List of all business card batches.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Batch #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sheets Required</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            // Skeleton loading rows
            [...Array(5)].map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell className="font-medium"><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell className="text-right"><Skeleton /></TableCell>
              </TableRow>
            ))
          ) : batches && batches.length > 0 ? (
            // Data rows
            batches.map((batch) => {
              const urgency = calculateJobUrgency(batch.due_date, productConfigs["BusinessCards"]);
              return (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.id.substring(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {batch.name}
                      {urgency && (
                        <Badge variant="outline" className={`gap-1 text-xs ${getBatchUrgencyColor(urgency)}`}>
                          {/* @ts-expect-error */}
                          <i data-lucide={getBatchUrgencyIcon(urgency)} className="w-3 h-3">{getBatchUrgencyIcon(urgency)}</i>
                          {urgency}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(batch.status)}`}>
                      {batch.status}
                    </span>
                  </TableCell>
                  <TableCell>{batch.sheets_required}</TableCell>
                  <TableCell>{formatDate(batch.due_date)}</TableCell>
                  <TableCell>{formatDate(batch.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/batches/business-cards/${batch.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/batches/business-cards/${batch.id}/edit`);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isDeleting && deletingBatchId === batch.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBatch(batch.id);
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {isDeleting && deletingBatchId === batch.id ? (
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            // Empty state
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No batches found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={7}>
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};

export default BatchesTable;
