
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { JobsTableBulkActionsBar } from "./JobsTableBulkActionsBar";
import { JobsTableHeader } from "./JobsTableHeader";
import { JobsTableModals } from "./JobsTableModals";
import { ColumnFilters } from "./ColumnFilters";
import { ResponsiveJobsTableContent } from "./ResponsiveJobsTableContent";
import { useJobsTableFilters } from "./JobsTableFilters";
import { useJobsTableSorting } from "./JobsTableSorting";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useCategories } from "@/hooks/tracker/useCategories";
import { useResponsiveJobsTable } from "./hooks/useResponsiveJobsTable";
import { useJobModalHandlers } from "./hooks/useJobModalHandlers";

interface ResponsiveJobsTableProps {
  filters?: {
    search?: string;
    filters?: string[];
  };
  onPartAssignment?: (job: any) => void;
}

export const ResponsiveJobsTable: React.FC<ResponsiveJobsTableProps> = ({ 
  filters = {},
  onPartAssignment 
}) => {
  const { jobs, isLoading, refreshJobs } = useEnhancedProductionJobs();
  const { categories } = useCategories();
  
  const {
    selectedJobs,
    setSelectedJobs,
    searchQuery,
    setSearchQuery,
    showColumnFilters,
    setShowColumnFilters,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    columnFilters,
    setColumnFilters,
    editingJob,
    setEditingJob,
    categoryAssignJob,
    setCategoryAssignJob,
    workflowInitJob,
    setWorkflowInitJob,
    showBulkOperations,
    setShowBulkOperations,
    showQRLabels,
    setShowQRLabels,
    handleSelectJob,
    handleSelectAll,
    handleColumnFilterChange,
    handleClearColumnFilters,
    handleSort,
    handleDeleteJob,
    handleBulkStatusUpdate,
    handleBulkDelete,
    handleCustomWorkflow
  } = useResponsiveJobsTable(refreshJobs);

  const {
    handleCategoryAssign,
    handleEditJob,
    handleWorkflowInit,
    handleWorkflowInitialize,
    handleCategoryAssignComplete,
    handleEditJobSave,
    handleBulkCategoryAssign
  } = useJobModalHandlers(
    refreshJobs,
    setEditingJob,
    setCategoryAssignJob,
    setWorkflowInitJob,
    selectedJobs,
    setSelectedJobs
  );

  const handlePartAssignment = (job: any) => {
    if (onPartAssignment) {
      onPartAssignment(job);
    }
  };

  // Initialize search from props
  React.useEffect(() => {
    if (filters.search && searchQuery !== filters.search) {
      setSearchQuery(filters.search);
    }
  }, [filters.search, searchQuery, setSearchQuery]);

  // Use filtering hook
  const { filteredJobs, availableCategories, availableStatuses, availableStages } = useJobsTableFilters({
    jobs,
    searchQuery,
    columnFilters
  });

  // Use sorting hook
  const filteredAndSortedJobs = useJobsTableSorting({
    jobs: filteredJobs,
    sortField,
    sortOrder
  });

  // Get selected jobs data for QR generation
  const selectedJobsData = jobs.filter(job => selectedJobs.includes(job.id));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading jobs...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <JobsTableHeader
        jobCount={filteredAndSortedJobs.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={refreshJobs}
        showColumnFilters={showColumnFilters}
        onToggleColumnFilters={() => setShowColumnFilters(!showColumnFilters)}
      />

      {/* Column Filters */}
      {showColumnFilters && (
        <Card>
          <ColumnFilters
            filters={columnFilters}
            onFilterChange={handleColumnFilterChange}
            onClearFilters={handleClearColumnFilters}
            availableCategories={availableCategories}
            availableStatuses={availableStatuses}
            availableStages={availableStages}
          />
        </Card>
      )}

      {/* Bulk Actions */}
      <JobsTableBulkActionsBar
        selectedJobsCount={selectedJobs.length}
        isDeleting={false}
        onBulkCategoryAssign={handleBulkCategoryAssign}
        onBulkStatusUpdate={handleBulkStatusUpdate}
        onBulkDelete={handleBulkDelete}
        onClearSelection={() => setSelectedJobs([])}
        onCustomWorkflow={handleCustomWorkflow}
        selectedJobs={selectedJobsData}
      />

      {/* Jobs Table */}
      <ResponsiveJobsTableContent
        filteredAndSortedJobs={filteredAndSortedJobs}
        selectedJobs={selectedJobs}
        sortField={sortField}
        sortOrder={sortOrder}
        onSelectJob={handleSelectJob}
        onSelectAll={(selected) => handleSelectAll(selected, filteredAndSortedJobs)}
        onSort={handleSort}
        onEditJob={handleEditJob}
        onCategoryAssign={handleCategoryAssign}
        onWorkflowInit={handleWorkflowInit}
        onDeleteJob={handleDeleteJob}
        onPartAssignment={handlePartAssignment}
      />

      {/* Modals */}
      <JobsTableModals
        editingJob={editingJob}
        categoryAssignJob={categoryAssignJob}
        workflowInitJob={workflowInitJob}
        showBulkOperations={showBulkOperations}
        showQRLabels={showQRLabels}
        selectedJobs={selectedJobsData}
        categories={categories}
        onCloseEditJob={() => setEditingJob(null)}
        onCloseCategoryAssign={() => setCategoryAssignJob(null)}
        onCloseWorkflowInit={() => setWorkflowInitJob(null)}
        onCloseBulkOperations={() => setShowBulkOperations(false)}
        onCloseQRLabels={() => setShowQRLabels(false)}
        onEditJobSave={handleEditJobSave}
        onCategoryAssignComplete={handleCategoryAssignComplete}
        onWorkflowInitialize={handleWorkflowInitialize}
        onOperationComplete={() => {
          setSelectedJobs([]);
          refreshJobs();
        }}
      />
    </div>
  );
};
