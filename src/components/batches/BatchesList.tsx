
import React from "react";
import { BatchSummary } from "./types/BatchTypes";
import BatchCard from "./BatchCard";
import EmptyState from "../business-cards/EmptyState";

interface BatchesListProps {
  batches: BatchSummary[];
  getBatchUrl: (batch: BatchSummary) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const BatchesList = ({ batches, getBatchUrl, isLoading, error, onRetry }: BatchesListProps) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <EmptyState type="loading" entityName="batches" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <EmptyState 
          type="error" 
          entityName="batches" 
          errorMessage={error}
          onRetry={onRetry} 
        />
      </div>
    );
  }
  
  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <EmptyState 
          type="empty" 
          entityName="batches"
          createPath="/batches/business-cards/jobs"
        />
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} getBatchUrl={getBatchUrl} />
      ))}
    </div>
  );
};

export default BatchesList;
