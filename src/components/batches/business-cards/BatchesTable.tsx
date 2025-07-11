
import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Eye, Trash2, FileText } from "lucide-react";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import BatchUrgencyIndicator from "@/components/batches/BatchUrgencyIndicator";
import { UrgencyLevel, calculateJobUrgency, getUrgencyBackgroundClass } from "@/utils/dateCalculations";
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
  const [batchesWithUrgency, setBatchesWithUrgency] = useState<(BatchSummary & { urgency: UrgencyLevel })[]>([]);
  const [urgencyLoading, setUrgencyLoading] = useState(true);

  useEffect(() => {
    const calculateUrgencies = async () => {
      if (batches.length === 0) {
        setBatchesWithUrgency([]);
        setUrgencyLoading(false);
        return;
      }

      const batchesWithUrgencyData = await Promise.all(
        batches.map(async (batch) => {
          const config = productConfigs[batch.product_type] || productConfigs["Business Cards"];
          const urgency = await calculateJobUrgency(batch.due_date, config);
          return { ...batch, urgency };
        })
      );
      setBatchesWithUrgency(batchesWithUrgencyData);
      setUrgencyLoading(false);
    };

    calculateUrgencies();
  }, [batches]);

  if (isLoading || urgencyLoading) {
    return <TableRow>
      <TableCell colSpan={7} className="text-center py-8">Loading batches...</TableCell>
    </TableRow>;
  }

  // Enhanced row background color based on urgency
  const getRowBackgroundColor = (status: string, urgency: UrgencyLevel) => {
    // If batch is completed, use status-based colors
    if (['completed', 'sent_to_print', 'cancelled'].includes(status)) {
      switch (status) {
        case 'completed':
          return 'bg-green-50 border-l-4 border-l-green-500';
        case 'sent_to_print':
          return 'bg-blue-50 border-l-4 border-l-blue-500';
        case 'cancelled':
          return 'bg-red-50 border-l-4 border-l-red-500';
        default:
          return '';
      }
    }
    
    // For active batches, use urgency-based colors
    return getUrgencyBackgroundClass(urgency);
  };

  // Sort batches - completed and sent_to_print at the bottom, then by urgency
  const sortedBatches = [...batchesWithUrgency].sort((a, b) => {
    const completedStatuses = ['completed', 'sent_to_print'];
    const aIsCompleted = completedStatuses.includes(a.status);
    const bIsCompleted = completedStatuses.includes(b.status);
    
    if (aIsCompleted && !bIsCompleted) return 1;
    if (!aIsCompleted && bIsCompleted) return -1;
    
    // If both have same completion status, sort by urgency (most urgent first)
    const urgencyOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return (
    <>
      {sortedBatches.map((batch) => {
        return (
          <TableRow 
            key={batch.id} 
            className={getRowBackgroundColor(batch.status, batch.urgency)}
          >
            <TableCell>
              <div className="flex items-center space-x-3">
                <BatchUrgencyIndicator 
                  urgencyLevel={batch.urgency}
                  earliestDueDate={batch.due_date}
                  productType={batch.product_type}
                  size="md"
                  showLabel={batch.urgency === 'critical' || batch.urgency === 'high'}
                />
                <span className={batch.urgency === 'critical' ? 'font-bold text-red-700' : ''}>{batch.name}</span>
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
            <TableCell>{batch.sheets_required || 0}</TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                <span className={batch.urgency === 'critical' ? 'font-bold text-red-700' : ''}>
                  {format(new Date(batch.due_date), 'MMM d, yyyy')}
                </span>
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
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
