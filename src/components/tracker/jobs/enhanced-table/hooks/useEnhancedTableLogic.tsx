
import React from "react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useUnifiedJobFiltering } from "@/hooks/tracker/useUnifiedJobFiltering";
import { useProductionCategories } from "@/hooks/tracker/useProductionCategories";
import { useJobActions } from "@/hooks/tracker/useAccessibleJobs/useJobActions";
import { useResponsiveJobsTable } from "../hooks/useResponsiveJobsTable";
import { useJobsTableFilters } from "../JobsTableFilters";
import { useJobsTableSorting } from "../JobsTableSorting";
import { toast } from "sonner";

interface UseEnhancedTableLogicProps {
  statusFilter?: string | null;
}

export const useEnhancedTableLogic = ({ statusFilter }: UseEnhancedTableLogicProps) => {
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

  const handleBulkMarkCompleted = async () => {
    if (selectedJobs.length === 0) {
      toast.error('No jobs selected to mark as completed');
      return;
    }
    
    console.log('🎯 Starting bulk completion process:', {
      selectedJobIds: selectedJobs,
      totalSelected: selectedJobs.length,
      statusFilter,
      currentJobsCount: filteredAndSortedJobs.length
    });
    
    let successCount = 0;
    let errorCount = 0;
    
    // Show processing toast
    const processingToast = toast.loading(`Processing ${selectedJobs.length} jobs...`);
    
    try {
      for (const jobId of selectedJobs) {
        console.log(`🎯 Processing job ${jobId}...`);
        
        try {
          const success = await markJobCompleted(jobId);
          if (success) {
            successCount++;
            console.log(`✅ Successfully completed job ${jobId}`);
          } else {
            errorCount++;
            console.error(`❌ Failed to complete job ${jobId}`);
          }
        } catch (err) {
          console.error(`❌ Error completing job ${jobId}:`, err);
          errorCount++;
        }
      }
      
      // Dismiss processing toast
      toast.dismiss(processingToast);
      
      console.log('🎯 Bulk completion summary:', {
        successCount,
        errorCount,
        totalProcessed: selectedJobs.length
      });
      
      if (successCount > 0) {
        toast.success(`Successfully marked ${successCount} job${successCount > 1 ? 's' : ''} as completed`);
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to complete ${errorCount} job${errorCount > 1 ? 's' : ''}`);
      }
      
    } catch (error) {
      toast.dismiss(processingToast);
      console.error('❌ Error in bulk completion:', error);
      toast.error('Failed to complete jobs');
    } finally {
      // Always clear selection first
      console.log('🔄 Clearing selection and refreshing...');
      setSelectedJobs([]);
      
      // Force immediate refresh with a small delay to ensure database propagation
      setTimeout(async () => {
        console.log('🔄 Executing forced refresh...');
        await refreshJobs();
        console.log('✅ Refresh completed');
      }, 500); // Small delay to ensure database updates have propagated
    }
  };

  const isLoading = jobsLoading || filteringLoading;

  return {
    // Data
    jobs,
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
  };
};
