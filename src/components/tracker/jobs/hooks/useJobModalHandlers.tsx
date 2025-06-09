
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useJobModalHandlers = (
  refreshJobs: () => void,
  setEditingJob: (job: any) => void,
  setCategoryAssignJob: (job: any) => void,
  setWorkflowInitJob: (job: any) => void,
  selectedJobs: any[],
  setSelectedJobs: (jobs: any[]) => void
) => {
  const handleCategoryAssign = useCallback((job?: any) => {
    if (job) {
      setCategoryAssignJob(job);
    } else if (selectedJobs.length > 0) {
      // Bulk category assignment - use first job for modal
      setCategoryAssignJob(selectedJobs[0]);
    }
  }, [selectedJobs, setCategoryAssignJob]);

  const handleEditJob = useCallback((job: any) => {
    setEditingJob(job);
  }, [setEditingJob]);

  const handleWorkflowInit = useCallback((job: any) => {
    setWorkflowInitJob(job);
  }, [setWorkflowInitJob]);

  const handleWorkflowInitialize = useCallback(async (job: any, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ 
          category_id: categoryId,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Workflow initialized successfully');
      setWorkflowInitJob(null);
      refreshJobs();
    } catch (err) {
      console.error('Error initializing workflow:', err);
      toast.error('Failed to initialize workflow');
    }
  }, [refreshJobs, setWorkflowInitJob]);

  const handleCategoryAssignComplete = useCallback(() => {
    setCategoryAssignJob(null);
    refreshJobs();
    setSelectedJobs([]);
  }, [setCategoryAssignJob, refreshJobs, setSelectedJobs]);

  const handleEditJobSave = useCallback(() => {
    setEditingJob(null);
    refreshJobs();
  }, [setEditingJob, refreshJobs]);

  const handleBulkCategoryAssign = useCallback(() => {
    if (selectedJobs.length > 0) {
      // Use first selected job for modal, but will apply to all selected
      const firstJob = selectedJobs[0];
      if (firstJob) {
        setCategoryAssignJob({
          ...firstJob,
          isMultiple: true,
          selectedIds: selectedJobs // FIX: Use selectedJobs directly, not .map(j => j.id)
        });
      }
    }
  }, [selectedJobs, setCategoryAssignJob]);

  return {
    handleCategoryAssign,
    handleEditJob,
    handleWorkflowInit,
    handleWorkflowInitialize,
    handleCategoryAssignComplete,
    handleEditJobSave,
    handleBulkCategoryAssign
  };
};
