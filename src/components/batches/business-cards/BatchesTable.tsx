
import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Eye, Trash2, FileText } from "lucide-react";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import BatchUrgencyIndicator from "@/components/batches/BatchUrgencyIndicator";
import { UrgencyLevel, calculateJobUrgency } from "@/utils/dateCalculations";
import { productConfigs } from "@/config/productTypes";

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
  if (isLoading) {
    return <TableRow>
      <TableCell colSpan={7} className="text-center py-8">Loading batches...</TableCell>
    </TableRow>;
  }

  // Helper function to determine batch urgency level
  const getBatchUrgency = (dueDate: string, productType: string): UrgencyLevel => {
    const config = productConfigs[productType] || productConfigs["BusinessCards"];
    return calculateJobUrgency(dueDate, config);
  };

  // Get row background color based on batch status and urgency
  const getRowBackgroundColor = (status: string, urgencyLevel: UrgencyLevel) => {
    // Status-based coloring (higher priority)
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-l-4 border-l-green-500';
      case 'sent_to_print':
        return 'bg-blue-50 border-l-4 border-l-blue-500';
      case 'processing':
        return 'bg-amber-50 border-l-4 border-l-amber-500';
      case 'cancelled':
        return 'bg-red-50 border-l-4 border-l-red-500';
    }
    
    // Urgency-based coloring (lower priority)
    switch (urgencyLevel) {
      case 'critical':
        return 'bg-red-50 border-l-4 border-l-red-500';
      case 'high':
        return 'bg-amber-50 border-l-4 border-l-amber-500';
      case 'medium':
        return 'bg-yellow-50 border-l-4 border-l-yellow-500';
      default:
        return '';
    }
  };

  // Sort batches - completed and sent_to_print at the bottom
  const sortedBatches = [...batches].sort((a, b) => {
    const completedStatuses = ['completed', 'sent_to_print'];
    const aIsCompleted = completedStatuses.includes(a.status);
    const bIsCompleted = completedStatuses.includes(b.status);
    
    if (aIsCompleted && !bIsCompleted) return 1;
    if (!aIsCompleted && bIsCompleted) return -1;
    
    // If both have same completion status, sort by due date (most urgent first)
    const aUrgency = getBatchUrgency(a.due_date, a.product_type);
    const bUrgency = getBatchUrgency(b.due_date, b.product_type);
    
    const urgencyOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    return urgencyOrder[aUrgency] - urgencyOrder[bUrgency];
  });

  return (
    <>
      {sortedBatches.map((batch) => {
        const urgencyLevel = getBatchUrgency(batch.due_date, batch.product_type);
        
        return (
          <TableRow 
            key={batch.id} 
            className={getRowBackgroundColor(batch.status, urgencyLevel)}
          >
            <TableCell>
              <div className="flex items-center space-x-2">
                <BatchUrgencyIndicator 
                  urgencyLevel={urgencyLevel}
                  earliestDueDate={batch.due_date}
                  productType={batch.product_type}
                />
                <span>{batch.name}</span>
              </div>
            </TableCell>
            <TableCell>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                batch.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : batch.status === 'processing'
                  ? 'bg-blue-100 text-blue-800'
                  : batch.status === 'sent_to_print'
                  ? 'bg-emerald-100 text-emerald-800'
                  : batch.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {batch.status.charAt(0).toUpperCase() + batch.status.slice(1).replace('_', ' ')}
              </span>
            </TableCell>
            <TableCell>{batch.sheets_required}</TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                {format(new Date(batch.due_date), 'MMM d, yyyy')}
              </div>
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
        );
      })}
    </>
  );
};

export default BatchesTable;
