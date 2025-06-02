import React from "react";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useUnifiedJobFiltering } from "@/hooks/tracker/useUnifiedJobFiltering";
import { useProductionCategories } from "@/hooks/tracker/useProductionCategories";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ColumnFilters } from "./ColumnFilters";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { CustomWorkflowModal } from "./CustomWorkflowModal";
import { useJobsTableFilters } from "./JobsTableFilters";
import { useJobsTableSorting } from "./JobsTableSorting";
import { useResponsiveJobsTable } from "./hooks/useResponsiveJobsTable";
import { BulkDeleteHandler } from "./BulkDeleteHandler";
import { EnhancedJobsTableHeader } from "./EnhancedJobsTableHeader";
import { JobsTableBulkActionsBar } from "./JobsTableBulkActionsBar";
import { JobsTableContent } from "./JobsTableContent";

interface EnhancedJobsTableWithBulkActionsProps {
  statusFilter?: string | null;
}

export const EnhancedJobsTableWithBulkActions: React.FC<EnhancedJobsTableWithBulkActionsProps> = ({ 
  statusFilter 
}) => {
  const { jobs, isLoading: jobsLoading, refreshJobs } = useEnhancedProductionJobs();
  const { categories } = useProductionCategories();
  
  // Use unified filtering to get user's accessible jobs
  const { 
    filteredJobs: accessibleJobs, 
    isLoading: filteringLoading 
  } = useUnifiedJobFiltering({
    jobs,
    statusFilter
  });

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
    handleBulkDelete: hookHandleBulkDelete,
    handleCustomWorkflow: hookHandleCustomWorkflow
  } = useResponsiveJobsTable(refreshJobs);

  // Add custom workflow state
  const [showCustomWorkflow, setShowCustomWorkflow] = React.useState(false);
  const [customWorkflowJob, setCustomWorkflowJob] = React.useState<any>(null);

  // Apply additional filtering to accessible jobs (search, column filters)
  const { filteredJobs, availableCategories, availableStatuses, availableStages } = useJobsTableFilters({
    jobs: accessibleJobs, // Use accessible jobs instead of all jobs
    searchQuery,
    columnFilters
  });

  // Use sorting hook
  const filteredAndSortedJobs = useJobsTableSorting({
    jobs: filteredJobs,
    sortField,
    sortOrder
  });

  console.log("🔍 EnhancedJobsTable - Processing:", {
    totalJobs: jobs.length,
    accessibleJobs: accessibleJobs.length,
    filteredJobs: filteredJobs.length,
    finalJobs: filteredAndSortedJobs.length,
    statusFilter,
    searchQuery,
    columnFilters
  });

  const handleEditJob = (job: any) => {
    setEditingJob(job);
  };

  const handleCategoryAssign = (job: any) => {
    setCategoryAssignJob(job);
  };

  const handleCustomWorkflowFromTable = (job: any) => {
    setCustomWorkflowJob(job);
    setShowCustomWorkflow(true);
  };

  const handleEditJobSave = () => {
    setEditingJob(null);
    refreshJobs();
  };

  const handleCategoryAssignComplete = () => {
    setCategoryAssignJob(null);
    refreshJobs();
  };

  const handleBulkCategoryAssign = () => {
    if (selectedJobs.length > 0) {
      const firstJob = jobs.find(job => job.id === selectedJobs[0]);
      if (firstJob) {
        setCategoryAssignJob({
          ...firstJob,
          isMultiple: true,
          selectedIds: selectedJobs
        });
      }
    }
  };

  const handleCustomWorkflow = () => {
    if (selectedJobs.length !== 1) {
      toast.error("Custom workflows can only be created for individual jobs");
      return;
    }
    const selectedJob = jobs.find(job => job.id === selectedJobs[0]);
    if (selectedJob) {
      setCustomWorkflowJob(selectedJob);
      setShowCustomWorkflow(true);
    }
  };

  const handleCustomWorkflowSuccess = () => {
    setShowCustomWorkflow(false);
    setCustomWorkflowJob(null);
    setSelectedJobs([]);
    refreshJobs();
  };

  const handleDeleteSingleJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      refreshJobs();
      
      // Remove from selection if it was selected
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  };

  const handleBulkDeleteComplete = () => {
    setSelectedJobs([]);
    refreshJobs();
  };

  const isLoading = jobsLoading || filteringLoading;

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
      <EnhancedJobsTableHeader
        jobCount={filteredAndSortedJobs.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={refreshJobs}
        showColumnFilters={showColumnFilters}
        setShowColumnFilters={setShowColumnFilters}
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
      <BulkDeleteHandler
        selectedJobs={selectedJobs}
        onDeleteComplete={handleBulkDeleteComplete}
      >
        {({ onShowDialog }) => (
          <JobsTableBulkActionsBar
            selectedJobsCount={selectedJobs.length}
            isDeleting={false}
            onBulkCategoryAssign={handleBulkCategoryAssign}
            onBulkStatusUpdate={handleBulkStatusUpdate}
            onBulkDelete={onShowDialog}
            onClearSelection={() => setSelectedJobs([])}
            onCustomWorkflow={handleCustomWorkflow}
            selectedJobs={accessibleJobs.filter(job => selectedJobs.includes(job.id))}
          />
        )}
      </BulkDeleteHandler>

      {/* Jobs Table */}
      <JobsTableContent
        jobs={filteredAndSortedJobs}
        selectedJobs={selectedJobs}
        sortField={sortField}
        sortOrder={sortOrder}
        onSelectJob={handleSelectJob}
        onSelectAll={(checked) => handleSelectAll(checked, filteredAndSortedJobs)}
        onSort={handleSort}
        onEditJob={handleEditJob}
        onCategoryAssign={handleCategoryAssign}
        onDeleteSingleJob={handleDeleteSingleJob}
        onCustomWorkflow={handleCustomWorkflowFromTable}
      />

      {/* Edit Job Modal */}
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={handleEditJobSave}
        />
      )}

      {/* Category Assign Modal */}
      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={handleCategoryAssignComplete}
        />
      )}

      {/* Custom Workflow Modal */}
      {showCustomWorkflow && customWorkflowJob && (
        <CustomWorkflowModal
          isOpen={showCustomWorkflow}
          onClose={() => {
            setShowCustomWorkflow(false);
            setCustomWorkflowJob(null);
          }}
          job={customWorkflowJob}
          onSuccess={handleCustomWorkflowSuccess}
        />
      )}
    </div>
  );
};
