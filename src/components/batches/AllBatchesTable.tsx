
import React from "react";
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
  // Get row background color based on batch status and urgency
  const getRowBackgroundColor = (batch: BatchSummary) => {
    // Status-based coloring (higher priority)
    switch (batch.status) {
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
    const productType = batch.product_type || "Business Cards";
    const config = productConfigs[productType] || productConfigs["BusinessCards"];
    const urgencyLevel = calculateJobUrgency(batch.due_date, config);
    
    switch (urgencyLevel) {
      case 'critical':
        return 'bg-red-50';
      case 'high':
        return 'bg-amber-50';
      case 'medium':
        return 'bg-yellow-50';
      default:
        return '';
    }
  };
  
  if (batches.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium">{emptyMessage}</h3>
        <p className="text-muted-foreground mt-1">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Product Type</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => {
            // Safely get product config, using default if not found
            const productType = batch.product_type || "Business Cards";
            // Normalize the product type key to match the keys in productConfigs
            const config = productConfigs[productType] || productConfigs["BusinessCards"];
            const urgencyLevel = calculateJobUrgency(batch.due_date, config);
            
            return (
              <TableRow 
                key={batch.id} 
                className={getRowBackgroundColor(batch)}
              >
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <BatchUrgencyIndicator 
                      urgencyLevel={urgencyLevel}
                      earliestDueDate={batch.due_date}
                      productType={productType}
                    />
                    <span>{batch.name}</span>
                  </div>
                </TableCell>
                <TableCell>{productType}</TableCell>
                <TableCell>{batch.due_date ? format(new Date(batch.due_date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
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
