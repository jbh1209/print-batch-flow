
import React from "react";
import { useEnhancedTableBusinessLogic } from "../EnhancedTableBusinessLogic";

export const useEnhancedTableHandlers = (
  normalizedJobs: any[],
  refreshJobs: () => void,
  setEditingJob: (job: any) => void,
  setCategoryAssignJob: (job: any) => void,
  setCustomWorkflowJob: (job: any) => void,
  setShowCustomWorkflow: (show: boolean) => void,
  setSelectedJobs: (jobs: string[]) => void
) => {
  // Business logic handlers
  const {
    handleEditJob,
    handleCategoryAssign,
    handleCustomWorkflowFromTable,
    handleBulkCategoryAssign,
    handleCustomWorkflow,
    handleDeleteSingleJob
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

  const handleCategoryAssignComplete = () => {
    setCategoryAssignJob(null);
    refreshJobs();
  };

  const handleBulkCategoryAssignWrapper = () => {
    const result = handleBulkCategoryAssign(setSelectedJobs);
    if (result) {
      setCategoryAssignJob(result);
    }
  };

  const handleCustomWorkflowWrapper = () => {
    const result = handleCustomWorkflow(setSelectedJobs);
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
      setSelectedJobs(normalizedJobs.filter(job => job.id !== jobId).map(job => job.id));
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
