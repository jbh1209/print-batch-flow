
import React from "react";
import { useEnhancedTableLogic } from "./enhanced-table/hooks/useEnhancedTableLogic";
import { useEnhancedTableHandlers } from "./enhanced-table/hooks/useEnhancedTableHandlers";
import { EnhancedTableWrapper } from "./enhanced-table/components/EnhancedTableWrapper";

interface EnhancedJobsTableWithBulkActionsProps {
  statusFilter?: string | null;
}

export const EnhancedJobsTableWithBulkActions: React.FC<EnhancedJobsTableWithBulkActionsProps> = ({ 
  statusFilter 
}) => {
  const {
    // Data
    normalizedJobs,
    filteredAndSortedJobs,
    categories,
    isLoading,
    
    // Table state
    selectedJobs,
    setSelectedJobs,
    searchQuery,
    setSearchQuery,
    showColumnFilters,
    setShowColumnFilters,
    sortField,
    sortOrder,
    columnFilters,
    
    // Handlers
    handleSelectJob,
    handleSelectAll,
    handleColumnFilterChange,
    handleClearColumnFilters,
    handleSort,
    handleBulkStatusUpdate,
    handleBulkMarkCompleted,
    refreshJobs,
    
    // Modal state
    editingJob,
    setEditingJob,
    categoryAssignJob,
    setCategoryAssignJob,
    
    // Filter data
    availableCategories,
    availableStatuses,
    availableStages
  } = useEnhancedTableLogic({ statusFilter });

  // Initialize custom workflow state variables first
  const [showCustomWorkflow, setShowCustomWorkflow] = React.useState(false);
  const [customWorkflowJob, setCustomWorkflowJob] = React.useState<any>(null);

  const {
    handleEditJobWrapper,
    handleCategoryAssignWrapper,
    handleCustomWorkflowFromTableWrapper,
    handleEditJobSave,
    handleCategoryAssignComplete,
    handleBulkCategoryAssignWrapper,
    handleCustomWorkflowWrapper,
    handleCustomWorkflowSuccess,
    handleDeleteSingleJobWrapper,
    handleBulkDeleteComplete
  } = useEnhancedTableHandlers(
    normalizedJobs,
    refreshJobs,
    setEditingJob,
    setCategoryAssignJob,
    setCustomWorkflowJob,
    setShowCustomWorkflow,
    setSelectedJobs
  );

  console.log("🔍 EnhancedJobsTable - Processing:", {
    totalJobs: normalizedJobs.length,
    filteredJobs: filteredAndSortedJobs.length,
    statusFilter,
    searchQuery,
    columnFilters
  });

  return (
    <EnhancedTableWrapper
      // Data props
      filteredAndSortedJobs={filteredAndSortedJobs}
      categories={categories}
      isLoading={isLoading}
      
      // Table state props
      selectedJobs={selectedJobs}
      searchQuery={searchQuery}
      showColumnFilters={showColumnFilters}
      sortField={sortField}
      sortOrder={sortOrder}
      
      // Modal state props
      editingJob={editingJob}
      categoryAssignJob={categoryAssignJob}
      
      // Filter data props
      availableCategories={availableCategories}
      availableStatuses={availableStatuses}
      availableStages={availableStages}
      columnFilters={columnFilters}
      
      // Handler props
      onSearchChange={setSearchQuery}
      onRefresh={refreshJobs}
      onShowColumnFiltersToggle={setShowColumnFilters}
      onSelectJob={handleSelectJob}
      onSelectAll={handleSelectAll}
      onSort={handleSort}
      onColumnFilterChange={(filters) => {
        // Handle the filters object by applying each filter
        Object.entries(filters).forEach(([key, value]) => {
          handleColumnFilterChange(key, value as string);
        });
      }}
      onClearColumnFilters={handleClearColumnFilters}
      onBulkCategoryAssign={handleBulkCategoryAssignWrapper}
      onBulkStatusUpdate={handleBulkStatusUpdate}
      onBulkMarkCompleted={handleBulkMarkCompleted}
      onBulkDeleteComplete={handleBulkDeleteComplete}
      onClearSelection={() => setSelectedJobs([])}
      onCustomWorkflow={handleCustomWorkflowWrapper}
      onEditJob={handleEditJobWrapper}
      onCategoryAssign={handleCategoryAssignWrapper}
      onDeleteSingleJob={handleDeleteSingleJobWrapper}
      onCustomWorkflowFromTable={handleCustomWorkflowFromTableWrapper}
      onEditJobSave={handleEditJobSave}
      onCategoryAssignComplete={handleCategoryAssignComplete}
      onCustomWorkflowSuccess={handleCustomWorkflowSuccess}
      
      // Custom workflow state
      showCustomWorkflow={showCustomWorkflow}
      customWorkflowJob={customWorkflowJob}
      onShowCustomWorkflowChange={setShowCustomWorkflow}
      onCustomWorkflowJobChange={setCustomWorkflowJob}
      
      // Job state setters
      onEditingJobChange={setEditingJob}
      onCategoryAssignJobChange={setCategoryAssignJob}
    />
  );
};
