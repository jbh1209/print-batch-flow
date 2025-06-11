
import React from "react";
import { useEnhancedTableBusinessLogic } from "../EnhancedTableBusinessLogic";

export const useEnhancedTableHandlers = (
  normalizedJobs: any[],
  refreshJobs: () => void,
  setEditingJob: (job: any) => void,
  setCategoryAssignJob: (job: any) => void,
  setCustomWorkflowJob: (job: any) => void,
  setShowCustomWorkflow: (show: boolean) => void,
  selectedJobs: string[],
  setSelectedJobs: (jobs: string[]) => void
) => {
  // Business logic handlers
  const {
    handleEditJob,
    handleCategoryAssign,
    handleCustomWorkflowFromTable,
    handleBulkCategoryAssign,
    handleCustomWorkflow,
    handleDeleteSingleJob,
    handleCategoryAssignmentComplete
  } = useEnhancedTableBusinessLogic(normalizedJobs, refreshJobs);

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

  const handleCategoryAssignComplete = async (job: any, categoryId: string, partAssignments?: Record<string, string>) => {
    const success = await handleCategoryAssignmentComplete(job, categoryId, partAssignments);
    if (success) {
      setCategoryAssignJob(null);
      refreshJobs();
    }
    return success;
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
      // Update selected jobs by filtering out the deleted job
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
      refreshJobs();
    }
  };

  const handleBulkDeleteComplete = () => {
    setSelectedJobs([]);
    refreshJobs();
  };

  return {
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
  };
};
