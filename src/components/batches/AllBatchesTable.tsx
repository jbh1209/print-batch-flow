
import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { calculateJobUrgency, getUrgencyBackgroundClass, UrgencyLevel } from "@/utils/dateCalculations";
import { productConfigs } from "@/config/productTypes";
import BatchUrgencyIndicator from "@/components/batches/BatchUrgencyIndicator";
import { BatchSummary } from "@/components/batches/types/BatchTypes";

interface AllBatchesTableProps {
  batches: BatchSummary[];
  getBadgeVariant: (status: string) => "default" | "secondary" | "destructive" | "outline" | "success";
  getBatchUrl: (batch: BatchSummary) => string;
  handleBatchClick: (url: string) => void;
  emptyMessage: string;
  emptyDescription: string;
}

const AllBatchesTable: React.FC<AllBatchesTableProps> = ({
  batches,
  getBadgeVariant,
  getBatchUrl,
  handleBatchClick,
  emptyMessage,
  emptyDescription
}) => {
  const [batchesWithUrgency, setBatchesWithUrgency] = useState<(BatchSummary & { urgency: UrgencyLevel })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateUrgencies = async () => {
      setIsLoading(true);
      const batchesWithUrgencyData = await Promise.all(
        batches.map(async (batch) => {
          const productType = batch.product_type || "Business Cards";
          const normalizedProductType = productType.replace(/\s+/g, '') as keyof typeof productConfigs;
          const config = productConfigs[normalizedProductType] || productConfigs["BusinessCards"];
          const urgency = await calculateJobUrgency(batch.due_date, config);
          return { ...batch, urgency };
        })
      );
      setBatchesWithUrgency(batchesWithUrgencyData);
      setIsLoading(false);
    };

    calculateUrgencies();
  }, [batches]);

  // Enhanced row background color based on urgency and status
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
  
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading batch urgencies...</p>
      </div>
    );
  }

  if (batchesWithUrgency.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium">{emptyMessage}</h3>
        <p className="text-muted-foreground mt-1">{emptyDescription}</p>
      </div>
    );
  }

  // Sort batches by urgency (most urgent first) for active batches
  const sortedBatches = [...batchesWithUrgency].sort((a, b) => {
    const urgencyOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name & Priority</TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
                      productType={batch.product_type || "Business Cards"}
                      size="md"
                      showLabel={batch.urgency === 'critical' || batch.urgency === 'high'}
                    />
                    <span className={batch.urgency === 'critical' ? 'font-bold text-red-700' : ''}>{batch.name}</span>
                  </div>
                </TableCell>
                <TableCell>{batch.product_type || "Business Cards"}</TableCell>
                <TableCell>
                  <span className={batch.urgency === 'critical' ? 'font-bold text-red-700' : ''}>
                    {batch.due_date ? format(new Date(batch.due_date), 'MMM dd, yyyy') : 'N/A'}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={getBadgeVariant(batch.status)}>
                    {batch.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="outline" 
                    onClick={() => handleBatchClick(getBatchUrl(batch))}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default AllBatchesTable;
