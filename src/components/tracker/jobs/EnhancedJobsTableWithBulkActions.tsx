import React from "react";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useProductionCategories } from "@/hooks/tracker/useProductionCategories";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BulkDeleteConfirmDialog } from "./BulkDeleteConfirmDialog";
import { ColumnFilters } from "./ColumnFilters";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { CustomWorkflowModal } from "./CustomWorkflowModal";
import { useJobsTableFilters } from "./JobsTableFilters";
import { useJobsTableSorting } from "./JobsTableSorting";
import { useJobsTableState } from "./useJobsTableState";
import { EnhancedJobsTableHeader } from "./EnhancedJobsTableHeader";
import { JobsTableBulkActionsBar } from "./JobsTableBulkActionsBar";
import { JobsTableContent } from "./JobsTableContent";

interface EnhancedJobsTableWithBulkActionsProps {
  statusFilter?: string | null;
}

export const EnhancedJobsTableWithBulkActions: React.FC<EnhancedJobsTableWithBulkActionsProps> = ({ 
  statusFilter 
}) => {
  const { jobs, isLoading, refreshJobs } = useEnhancedProductionJobs();
  const { categories } = useProductionCategories();
  
  const {
    selectedJobs,
    setSelectedJobs,
    searchQuery,
    setSearchQuery,
    showDeleteDialog,
    setShowDeleteDialog,
    isDeleting,
    setIsDeleting,
    showColumnFilters,
    setShowColumnFilters,
    editingJob,
    setEditingJob,
    categoryAssignJob,
    setCategoryAssignJob,
    sortField,
    sortOrder,
    columnFilters,
    handleSelectJob,
    handleSelectAll,
    handleSort,
    handleColumnFilterChange,
    handleClearColumnFilters
  } = useJobsTableState();

  // Add custom workflow state
  const [showCustomWorkflow, setShowCustomWorkflow] = React.useState(false);
  const [customWorkflowJob, setCustomWorkflowJob] = React.useState<any>(null);

  // Apply status filter from sidebar
  const getFilteredJobsByStatus = () => {
    if (!statusFilter) {
      // Default: show production jobs (excluding completed)
      return jobs.filter(job => job.status?.toLowerCase() !== 'completed');
    }
    
    switch (statusFilter) {
      case 'completed':
        return jobs.filter(job => job.status?.toLowerCase() === 'completed');
      case 'in-progress':
        return jobs.filter(job => 
          job.status && ['printing', 'finishing', 'production', 'pre-press', 'packaging'].includes(job.status.toLowerCase())
        );
      case 'pending':
        return jobs.filter(job => 
          job.status?.toLowerCase() === 'pending' || !job.status
        );
      case 'overdue':
        return jobs.filter(job => 
          job.due_date && new Date(job.due_date) < new Date() && job.status?.toLowerCase() !== 'completed'
        );
      default:
        return jobs.filter(job => job.status?.toLowerCase() !== 'completed');
    }
  };

  const statusFilteredJobs = getFilteredJobsByStatus();

  // Use filtering hook with status filtered jobs
  const { filteredJobs, availableCategories, availableStatuses, availableStages } = useJobsTableFilters({
    jobs: statusFilteredJobs,
    searchQuery,
    columnFilters
  });

  // Use sorting hook
  const filteredAndSortedJobs = useJobsTableSorting({
    jobs: filteredJobs,
    sortField,
    sortOrder
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

  const handleBulkDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleBulkCategoryAssign = () => {
    if (selectedJobs.length > 0) {
      // Use first selected job for modal, but will apply to all selected
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

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedJobs.length === 0) return;

    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedJobs);

      if (error) throw error;

      toast.success(`Successfully updated ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''} to ${newStatus}`);
      setSelectedJobs([]);
      refreshJobs();
    } catch (err) {
      console.error('Error updating job status:', err);
      toast.error('Failed to update job status');
    }
  };

  const handleConfirmBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', selectedJobs);

      if (error) throw error;

      toast.success(`Successfully deleted ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''}`);
      setSelectedJobs([]);
      setShowDeleteDialog(false);
      refreshJobs();
    } catch (err) {
      console.error('Error deleting jobs:', err);
      toast.error('Failed to delete jobs');
    } finally {
      setIsDeleting(false);
    }
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
      {/* Header and Search - No status filters here */}
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
      <JobsTableBulkActionsBar
        selectedJobsCount={selectedJobs.length}
        isDeleting={isDeleting}
        onBulkCategoryAssign={handleBulkCategoryAssign}
        onBulkStatusUpdate={handleBulkStatusUpdate}
        onBulkDelete={handleBulkDelete}
        onClearSelection={() => setSelectedJobs([])}
        onCustomWorkflow={handleCustomWorkflow}
        selectedJobs={jobs.filter(job => selectedJobs.includes(job.id))}
      />

      {/* Jobs Table with ScrollArea */}
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

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmBulkDelete}
        jobCount={selectedJobs.length}
        isDeleting={isDeleting}
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
