
import React from 'react';
import { ProductionManagerHeader } from './ProductionManagerHeader';
import { ProductionManagerStats } from './ProductionManagerStats';
import { ProductionBulkActionsBar } from './ProductionBulkActionsBar';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { useProductionJobs } from '@/contexts/ProductionJobsContext';
import { useProductionOperations } from '@/hooks/tracker/useProductionOperations';

interface ProductionStickyHeaderProps {
  jobs: AccessibleJob[];
  statusFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  uniqueStatuses: string[];
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  refreshJobs: () => Promise<void>;
  isAdmin: boolean;
}

export const ProductionStickyHeader: React.FC<ProductionStickyHeaderProps> = ({
  jobs,
  statusFilter,
  setStatusFilter,
  uniqueStatuses,
  onRefresh,
  refreshing,
  refreshJobs,
  isAdmin,
}) => {
  const { selectedJobs } = useProductionJobs();
  const {
    selectedJobsData,
    handleBulkCategoryAssign,
    handleBulkStatusUpdate,
    handleBulkMarkCompleted,
    handleBulkDelete,
    handleGenerateBarcodes,
  } = useProductionOperations(jobs, refreshJobs);

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <ProductionManagerHeader
        jobCount={jobs.length}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        uniqueStatuses={uniqueStatuses}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      {/* Production Statistics */}
      <ProductionManagerStats jobs={jobs} />

      {/* Bulk Actions Bar - only show when jobs are selected */}
      {selectedJobs.length > 0 && (
        <div className="animate-fade-in">
          <ProductionBulkActionsBar
            selectedJobsCount={selectedJobs.length}
            onBulkCategoryAssign={() => handleBulkCategoryAssign(selectedJobsData)}
            onBulkStatusUpdate={(status) => handleBulkStatusUpdate(selectedJobsData, status)}
            onBulkMarkCompleted={() => handleBulkMarkCompleted(selectedJobsData)}
            onBulkDelete={() => handleBulkDelete(selectedJobsData)}
            onGenerateBarcodes={() => handleGenerateBarcodes(selectedJobsData)}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
};
