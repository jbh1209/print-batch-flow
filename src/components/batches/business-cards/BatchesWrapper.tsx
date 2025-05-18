
import React from 'react';
import { BatchSummary } from '@/components/batches/types/BatchTypes';
import { BatchWithJobs } from '../types/BusinessCardTypes';
import BatchesTable from './BatchesTable';
import BatchesPagination from '../BatchesPagination';
import { useEffect, useState } from 'react';
import BatchesLoading from '../BatchesLoading';
import BatchesEmpty from '../BatchesEmpty';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BatchesWrapperProps {
  batches: BatchSummary[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: (id: string) => void;
  onViewDetails: (id: string) => void;
}

const BatchesWrapper: React.FC<BatchesWrapperProps> = ({
  batches,
  isLoading,
  error,
  onRefresh,
  onViewPDF,
  onDeleteBatch,
  onViewDetails,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const batchesPerPage = 10;
  const [paginatedBatches, setPaginatedBatches] = useState<BatchSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (batches) {
      const totalPages = Math.ceil(batches.length / batchesPerPage);
      setTotalPages(totalPages || 1);

      const startIndex = (currentPage - 1) * batchesPerPage;
      const endIndex = startIndex + batchesPerPage;
      setPaginatedBatches(batches.slice(startIndex, endIndex));
    } else {
      setPaginatedBatches([]);
      setTotalPages(1);
    }
  }, [batches, currentPage, batchesPerPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (isLoading) {
    return <BatchesLoading />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading batches</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Try Again
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!batches || batches.length === 0) {
    return <BatchesEmpty />;
  }

  // Convert BatchSummary[] to BatchWithJobs[] for compatibility with BatchesTable
  const batchesWithEmptyJobs: BatchWithJobs[] = paginatedBatches.map(batch => ({
    ...batch,
    jobs: [] // Add empty jobs array to satisfy BatchWithJobs type
  }));

  return (
    <>
      <BatchesTable
        batches={batchesWithEmptyJobs}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onRefresh={onRefresh}
      />
      {totalPages > 1 && (
        <BatchesPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </>
  );
};

export default BatchesWrapper;
