
import React from 'react';
import { BatchListCard } from './BatchListCard';
import { BaseBatch } from '@/config/productTypes';

interface BatchListGridProps {
  batches: BaseBatch[];
  onViewPDF: (url: string | null) => void;
  onViewBatchDetails: (id: string) => void;
  onSetBatchToDelete: (id: string | null) => void;
}

export const BatchListGrid: React.FC<BatchListGridProps> = ({
  batches,
  onViewPDF,
  onViewBatchDetails,
  onSetBatchToDelete
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {batches.map((batch) => (
        <BatchListCard 
          key={batch.id}
          batch={batch}
          onViewPDF={onViewPDF}
          onViewBatchDetails={onViewBatchDetails}
          onSetBatchToDelete={onSetBatchToDelete}
        />
      ))}
    </div>
  );
};
