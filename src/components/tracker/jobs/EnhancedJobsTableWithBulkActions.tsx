
import React from "react";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useUnifiedJobFiltering } from "@/hooks/tracker/useUnifiedJobFiltering";
import { useProductionCategories } from "@/hooks/tracker/useProductionCategories";
import { useJobsTableFilters } from "./JobsTableFilters";
import { useJobsTableSorting } from "./JobsTableSorting";
import { useResponsiveJobsTable } from "./hooks/useResponsiveJobsTable";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { JobTableContent } from "./table/JobTableContent";
import { EnhancedTableHeader } from "./enhanced-table/EnhancedTableHeader";
import { EnhancedTableFilters } from "./enhanced-table/EnhancedTableFilters";
import { EnhancedTableBulkActions } from "./enhanced-table/EnhancedTableBulkActions";
import { EnhancedTableModals } from "./enhanced-table/EnhancedTableModals";
import { useEnhancedTableBusinessLogic } from "./enhanced-table/EnhancedTableBusinessLogic";
import { toast } from "sonner";

interface EnhancedJobsTableWithBulkActionsProps {
  statusFilter?: string | null;
}

export const EnhancedJobsTableWithBulkActions: React.FC<EnhancedJobsTableWithBulkActionsProps> = ({ 
  statusFilter 
}) => {
  const { jobs, isLoading: jobsLoading, refreshJobs } = useEnhancedProductionJobs();
  const { categories } = useProductionCategories();
  const { markJobCompleted } = useJobActions(refreshJobs);
  
  // Use unified filtering to get user's accessible jobs
  const { 
    filteredJobs: accessibleJobs, 
    isLoading: filteringLoading 
  } = useUnifiedJobFiltering({
    jobs,
    statusFilter
  });

  // Map job data structure to ensure consistent ID property
  const normalizedJobs = React.useMemo(() => {
    return accessibleJobs.map(job => ({
      ...job,
      id: job.id || job.job_id || job.job_id
    }));
  }, [accessibleJobs]);

  // State and Handlers from useResponsiveJobsTable
  const {
    selectedJobs,
    setSelectedJobs,
    searchQuery,
    setSearchQuery,
    showColumnFilters,
    setShowColumnFilters,
    sortField,
    sortOrder,
    columnFilters,
    handleSelectJob,
    handleSelectAll,
    handleColumnFilterChange,
    handleClearColumnFilters,
    handleSort,
    handleBulkStatusUpdate,
    editingJob,
    setEditingJob,
    categoryAssignJob,
    setCategoryAssignJob
  } = useResponsiveJobsTable(refreshJobs);

  // Custom workflow state
  const [showCustomWorkflow, setShowCustomWorkflow] = React.useState(false);
  const [customWorkflowJob, setCustomWorkflowJob] = React.useState<any>(null);

  // Business logic handlers
  const {
    handleEditJob,
    handleCategoryAssign,
    handleCustomWorkflowFromTable,
    handleBulkCategoryAssign,
    handleCustomWorkflow,
    handleDeleteSingleJob
  } = useEnhancedTableBusinessLogic(normalizedJobs, refreshJobs);

  // Apply additional filtering to normalized jobs (search, column filters)
  const { filteredJobs, availableCategories, availableStatuses, availableStages } = useJobsTableFilters({
    jobs: normalizedJobs,
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
    normalizedJobs: normalizedJobs.length,
    filteredJobs: filteredJobs.length,
    finalJobs: filteredAndSortedJobs.length,
    statusFilter,
    searchQuery,
    columnFilters
  });

  const handleEditJobWrapper = (job: any) => {
    setEditingJob(handleEditJob(job));
  };

  const handleCategoryAssignWrapper = (job: any) => {
    setCategoryAssignJob(handleCategoryAssign(job));
  };

  const handleCustomWorkflowFromTableWrapper = (job: any) => {
    setCustomWorkflowJob(handleCustomWorkflowFromTable(job));
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

  const handleBulkCategoryAssignWrapper = () => {
    const result = handleBulkCategoryAssign(selectedJobs);
    if (result) {
      setCategoryAssignJob(result);
    }
  };

  const handleCustomWorkflowWrapper = () => {
    const result = handleCustomWorkflow(selectedJobs);
    if (result) {
      setCustomWorkflowJob(result);
      setShowCustomWorkflow(true);
    }
  };

  const handleCustomWorkflowSuccess = () => {
    setShowCustomWorkflow(false);
    setCustomWorkflowJob(null);
    setSelectedJobs([]);
    refreshJobs();
  };

  const handleDeleteSingleJobWrapper = async (jobId: string) => {
    const success = await handleDeleteSingleJob(jobId);
    if (success) {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleBulkDeleteComplete = () => {
    setSelectedJobs([]);
    refreshJobs();
  };

  const handleBulkMarkCompleted = async () => {
    if (selectedJobs.length === 0) return;
    
    console.log('🎯 Bulk marking jobs as completed:', selectedJobs);
    
    try {
      let successCount = 0;
      
      for (const jobId of selectedJobs) {
        const success = await markJobCompleted(jobId);
        if (success) {
          successCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully marked ${successCount} job${successCount > 1 ? 's' : ''} as completed`);
        setSelectedJobs([]);
        refreshJobs();
      }
    } catch (error) {
      console.error('❌ Error in bulk completion:', error);
      toast.error('Failed to complete some jobs');
    }
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
      <EnhancedTableHeader
        jobCount={filteredAndSortedJobs.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={refreshJobs}
        showColumnFilters={showColumnFilters}
        setShowColumnFilters={setShowColumnFilters}
      />

      {/* Column Filters */}
      <EnhancedTableFilters
        showColumnFilters={showColumnFilters}
        columnFilters={columnFilters}
        onFilterChange={handleColumnFilterChange}
        onClearFilters={handleClearColumnFilters}
        availableCategories={availableCategories}
        availableStatuses={availableStatuses}
        availableStages={availableStages}
      />

      {/* Bulk Actions */}
      <EnhancedTableBulkActions
        selectedJobs={selectedJobs}
        normalizedJobs={normalizedJobs}
        onBulkCategoryAssign={handleBulkCategoryAssignWrapper}
        onBulkStatusUpdate={handleBulkStatusUpdate}
        onBulkMarkCompleted={handleBulkMarkCompleted}
        onDeleteComplete={handleBulkDeleteComplete}
        onClearSelection={() => setSelectedJobs([])}
        onCustomWorkflow={handleCustomWorkflowWrapper}
      />

      {/* Jobs Table */}
      <JobTableContent
        jobs={filteredAndSortedJobs}
        selectedJobs={selectedJobs}
        sortField={sortField}
        sortOrder={sortOrder}
        onSelectJob={handleSelectJob}
        onSelectAll={(checked) => handleSelectAll(checked, filteredAndSortedJobs)}
        onSort={handleSort}
        onEditJob={handleEditJobWrapper}
        onCategoryAssign={handleCategoryAssignWrapper}
        onDeleteSingleJob={handleDeleteSingleJobWrapper}
        onCustomWorkflow={handleCustomWorkflowFromTableWrapper}
      />

      {/* Modals */}
      <EnhancedTableModals
        editingJob={editingJob}
        setEditingJob={setEditingJob}
        categoryAssignJob={categoryAssignJob}
        setCategoryAssignJob={setCategoryAssignJob}
        showCustomWorkflow={showCustomWorkflow}
        setShowCustomWorkflow={setShowCustomWorkflow}
        customWorkflowJob={customWorkflowJob}
        setCustomWorkflowJob={setCustomWorkflowJob}
        categories={categories}
        onEditJobSave={handleEditJobSave}
        onCategoryAssignComplete={handleCategoryAssignComplete}
        onCustomWorkflowSuccess={handleCustomWorkflowSuccess}
      />
    </div>
  );
};
