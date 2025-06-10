
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
  // Custom workflow state
  const [showCustomWorkflow, setShowCustomWorkflowState] = React.useState(false);
  const [customWorkflowJob, setCustomWorkflowJobState] = React.useState<any>(null);

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
    setCustomWorkflowJobState(handleCustomWorkflowFromTable(job));
    setShowCustomWorkflowState(true);
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
      setCustomWorkflowJobState(result);
      setShowCustomWorkflowState(true);
    }
  };

  const handleCustomWorkflowSuccess = () => {
    setShowCustomWorkflowState(false);
    setCustomWorkflowJobState(null);
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

  return {
    showCustomWorkflow,
    customWorkflowJob,
    handleEditJobWrapper,
    handleCategoryAssignWrapper,
    handleCustomWorkflowFromTableWrapper,
    handleEditJobSave,
    handleCategoryAssignComplete,
    handleBulkCategoryAssignWrapper,
    handleCustomWorkflowWrapper,
    handleCustomWorkflowSuccess,
    handleDeleteSingleJobWrapper,
    handleBulkDeleteComplete,
    setShowCustomWorkflow: setShowCustomWorkflowState,
    setCustomWorkflowJob: setCustomWorkflowJobState
  };
};
