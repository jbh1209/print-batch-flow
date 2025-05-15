import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import BatchesTable from "./BatchesTable";
import EmptyState from "@/components/business-cards/EmptyState";
import { BatchSummary } from "@/components/batches/types/BatchTypes";

interface BatchesWrapperProps {
  batches: BatchSummary[];
  isLoading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: (batchId: string) => void;
  onViewDetails?: (batchId: string) => void; // Add this line to support viewing batch details
}

const BatchesWrapper = ({
  batches,
  isLoading,
  error,
  onRefresh,
  onViewPDF,
  onDeleteBatch,
  onViewDetails
}: BatchesWrapperProps) => {
  const navigate = useNavigate();
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border shadow p-8">
        <EmptyState type="loading" entityName="batches" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg border shadow p-8">
        <EmptyState 
          type="error" 
          entityName="batches" 
          errorMessage={error}
          onRetry={onRefresh} 
        />
      </div>
    );
  }
  
  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-lg border shadow p-8">
        <EmptyState 
          type="empty" 
          entityName="batches"
        />
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border shadow mb-8">
      <div className="border-b p-4 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {batches.length} {batches.length === 1 ? 'batch' : 'batches'} found
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">Refresh</Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sheets</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <BatchesTable
              batches={batches}
              isLoading={false}
              onViewPDF={onViewPDF}
              onDeleteBatch={onDeleteBatch}
              onViewDetails={onViewDetails} // Pass the onViewDetails prop to BatchesTable
            />
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BatchesWrapper;
