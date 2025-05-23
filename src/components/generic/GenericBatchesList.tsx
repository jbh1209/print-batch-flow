
import { useState } from 'react';
import { BaseBatch } from '@/config/productTypes';
import { BatchListHeader } from './batch-list/BatchListHeader';
import { BatchListEmptyState } from './batch-list/BatchListEmptyState';
import { BatchListGrid } from './batch-list/BatchListGrid';
import { BatchDeleteConfirmation } from './batch-list/BatchDeleteConfirmation';

interface GenericBatchesListProps {
  batches: BaseBatch[];
  isLoading: boolean;
  error: string | null;
  batchToDelete: string | null;
  isDeleting: boolean;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: () => Promise<void>;
  onViewBatchDetails: (id: string) => void;
  onSetBatchToDelete: (id: string | null) => void;
  productType: string;
  title: string;
}

export const GenericBatchesList = ({
  batches,
  isLoading,
  error,
  batchToDelete,
  isDeleting,
  onViewPDF,
  onDeleteBatch,
  onViewBatchDetails,
  onSetBatchToDelete,
  productType,
  title
}: GenericBatchesListProps) => {
  if (isLoading || error || batches.length === 0) {
    return (
      <div>
        <BatchListHeader title={title} productType={productType} />
        <BatchListEmptyState 
          isLoading={isLoading} 
          error={error} 
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
  
  return (
    <div>
      <BatchListHeader title={title} productType={productType} />
      <BatchListGrid 
        batches={batches}
        onViewPDF={onViewPDF}
        onViewBatchDetails={onViewBatchDetails}
        onSetBatchToDelete={onSetBatchToDelete}
      />
      
      <BatchDeleteConfirmation
        batchToDelete={batchToDelete}
        onCancel={() => onSetBatchToDelete(null)}
        onDelete={onDeleteBatch}
      />
    </div>
  );
};
