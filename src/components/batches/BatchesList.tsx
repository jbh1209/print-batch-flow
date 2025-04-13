
import React from "react";
import { BatchSummary } from "./types/BatchTypes";
import BatchCard from "./BatchCard";

interface BatchesListProps {
  batches: BatchSummary[];
  getBatchUrl: (batch: BatchSummary) => string;
}

const BatchesList = ({ batches, getBatchUrl }: BatchesListProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} getBatchUrl={getBatchUrl} />
      ))}
    </div>
  );
};

export default BatchesList;
