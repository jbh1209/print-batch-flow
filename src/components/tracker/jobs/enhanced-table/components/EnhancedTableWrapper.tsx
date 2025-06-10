
import React from "react";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { JobsTableContent } from "../../JobsTableContent";
import { EnhancedTableHeader } from "../EnhancedTableHeader";
import { EnhancedTableFilters } from "../EnhancedTableFilters";
import { EnhancedTableBulkActions } from "../EnhancedTableBulkActions";
import { EnhancedTableModals } from "../EnhancedTableModals";

interface EnhancedTableWrapperProps {
  // Data props
  filteredAndSortedJobs: any[];
  categories: any[];
  isLoading: boolean;
  
  // Table state props
  selectedJobs: string[];
  searchQuery: string;
  showColumnFilters: boolean;
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
  
  // Modal state props
  editingJob: any;
  categoryAssignJob: any;
  
  // Filter data props
  availableCategories: string[];
  availableStatuses: string[];
  availableStages: string[];
  columnFilters: any;
  
  // Handler props
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onShowColumnFiltersToggle: (show: boolean) => void;
  onSelectJob: (jobId: string, selected: boolean) => void;
  onSelectAll: (checked: boolean, jobs: any[]) => void;
  onSort: (field: string) => void;
  onColumnFilterChange: (filters: any) => void;
  onClearColumnFilters: () => void;
  onBulkCategoryAssign: () => void;
  onBulkStatusUpdate: (status: string) => void;
  onBulkMarkCompleted: () => void;
  onBulkDeleteComplete: () => void;
  onClearSelection: () => void;
  onCustomWorkflow: () => void;
  onEditJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onDeleteSingleJob: (jobId: string) => Promise<void>;
  onCustomWorkflowFromTable: (job: any) => void;
  onEditJobSave: () => void;
  onCategoryAssignComplete: () => void;
  onCustomWorkflowSuccess: () => void;
  
  // Custom workflow state
  showCustomWorkflow: boolean;
  customWorkflowJob: any;
  onShowCustomWorkflowChange: (show: boolean) => void;
  onCustomWorkflowJobChange: (job: any) => void;
  
  // Job state setters
  onEditingJobChange: (job: any) => void;
  onCategoryAssignJobChange: (job: any) => void;
}

export const EnhancedTableWrapper: React.FC<EnhancedTableWrapperProps> = ({
  filteredAndSortedJobs,
  categories,
  isLoading,
  selectedJobs,
  searchQuery,
  showColumnFilters,
  sortField,
  sortOrder,
  editingJob,
  categoryAssignJob,
  availableCategories,
  availableStatuses,
  availableStages,
  columnFilters,
  onSearchChange,
  onRefresh,
  onShowColumnFiltersToggle,
  onSelectJob,
  onSelectAll,
  onSort,
  onColumnFilterChange,
  onClearColumnFilters,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkMarkCompleted,
  onBulkDeleteComplete,
  onClearSelection,
  onCustomWorkflow,
  onEditJob,
  onCategoryAssign,
  onDeleteSingleJob,
  onCustomWorkflowFromTable,
  onEditJobSave,
  onCategoryAssignComplete,
  onCustomWorkflowSuccess,
  showCustomWorkflow,
  customWorkflowJob,
  onShowCustomWorkflowChange,
  onCustomWorkflowJobChange,
  onEditingJobChange,
  onCategoryAssignJobChange
}) => {
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading jobs...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Search */}
      <EnhancedTableHeader
        jobCount={filteredAndSortedJobs.length}
        searchQuery={searchQuery}
        setSearchQuery={onSearchChange}
        onRefresh={onRefresh}
        showColumnFilters={showColumnFilters}
        setShowColumnFilters={onShowColumnFiltersToggle}
      />

      {/* Column Filters */}
      <EnhancedTableFilters
        showColumnFilters={showColumnFilters}
        columnFilters={columnFilters}
        onFilterChange={onColumnFilterChange}
        onClearFilters={onClearColumnFilters}
        availableCategories={availableCategories}
        availableStatuses={availableStatuses}
        availableStages={availableStages}
      />

      {/* Bulk Actions */}
      <EnhancedTableBulkActions
        selectedJobs={selectedJobs}
        normalizedJobs={filteredAndSortedJobs}
        onBulkCategoryAssign={onBulkCategoryAssign}
        onBulkStatusUpdate={onBulkStatusUpdate}
        onBulkMarkCompleted={onBulkMarkCompleted}
        onDeleteComplete={onBulkDeleteComplete}
        onClearSelection={onClearSelection}
        onCustomWorkflow={onCustomWorkflow}
      />

      {/* Jobs Table */}
      <JobsTableContent
        jobs={filteredAndSortedJobs}
        selectedJobs={selectedJobs}
        sortField={sortField}
        sortOrder={sortOrder}
        onSelectJob={onSelectJob}
        onSelectAll={(checked) => onSelectAll(checked, filteredAndSortedJobs)}
        onSort={onSort}
        onEditJob={onEditJob}
        onCategoryAssign={onCategoryAssign}
        onDeleteSingleJob={onDeleteSingleJob}
        onCustomWorkflow={onCustomWorkflowFromTable}
      />

      {/* Modals */}
      <EnhancedTableModals
        editingJob={editingJob}
        setEditingJob={onEditingJobChange}
        categoryAssignJob={categoryAssignJob}
        setCategoryAssignJob={onCategoryAssignJobChange}
        showCustomWorkflow={showCustomWorkflow}
        setShowCustomWorkflow={onShowCustomWorkflowChange}
        customWorkflowJob={customWorkflowJob}
        setCustomWorkflowJob={onCustomWorkflowJobChange}
        categories={categories}
        onEditJobSave={onEditJobSave}
        onCategoryAssignComplete={onCategoryAssignComplete}
        onCustomWorkflowSuccess={onCustomWorkflowSuccess}
      />
    </div>
  );
};
