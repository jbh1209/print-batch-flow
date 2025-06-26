
import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { useProductionJobs } from '@/contexts/ProductionJobsContext';
import { useUserRole } from '@/hooks/tracker/useUserRole';

export const useProductionOperations = (
  jobs: AccessibleJob[],
  refreshJobs: () => Promise<void>
) => {
  const { isAdmin } = useUserRole();
  const { 
    selectedJobs, 
    clearSelection,
    setCategoryAssignJob,
    setSelectedJobsForBarcodes,
    setShowBarcodeLabels
  } = useProductionJobs();

  const getSelectedJobsData = useCallback(() => {
    return jobs.filter(job => selectedJobs.includes(job.job_id));
  }, [jobs, selectedJobs]);

  const handleBulkCategoryAssign = useCallback((selectedJobsData: AccessibleJob[]) => {
    if (selectedJobsData.length > 0) {
      const firstJob = {
        ...selectedJobsData[0],
        id: selectedJobsData[0].job_id,
        isMultiple: true,
        selectedIds: selectedJobsData.map(j => j.job_id)
      };
      setCategoryAssignJob(firstJob as any);
    }
  }, [setCategoryAssignJob]);

  const handleBulkStatusUpdate = useCallback(async (selectedJobsData: AccessibleJob[], status: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ status })
        .in('id', selectedJobsData.map(j => j.job_id));

      if (error) throw error;

      toast.success(`Updated ${selectedJobsData.length} job(s) to ${status} status`);
      await refreshJobs();
      clearSelection();
    } catch (err) {
      console.error('Error updating job status:', err);
      toast.error('Failed to update job status');
    }
  }, [refreshJobs, clearSelection]);

  const handleBulkMarkCompleted = useCallback(async (selectedJobsData: AccessibleJob[]) => {
    if (!isAdmin) {
      toast.error('Only administrators can mark jobs as completed');
      return;
    }

    try {
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({ 
          status: 'Completed',
          updated_at: new Date().toISOString()
        })
        .in('id', selectedJobsData.map(j => j.job_id));

      if (jobError) throw jobError;

      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .in('job_id', selectedJobsData.map(j => j.job_id))
        .in('status', ['active', 'pending']);

      if (stageError) throw stageError;

      toast.success(`Marked ${selectedJobsData.length} job(s) as completed`);
      await refreshJobs();
      clearSelection();
    } catch (err) {
      console.error('Error marking jobs as completed:', err);
      toast.error('Failed to mark jobs as completed');
    }
  }, [isAdmin, refreshJobs, clearSelection]);

  const handleBulkDelete = useCallback(async (selectedJobsData: AccessibleJob[]) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', selectedJobsData.map(j => j.job_id));

      if (error) throw error;

      toast.success(`Deleted ${selectedJobsData.length} job(s) successfully`);
      await refreshJobs();
      clearSelection();
    } catch (err) {
      console.error('Error deleting jobs:', err);
      toast.error('Failed to delete jobs');
    }
  }, [refreshJobs, clearSelection]);

  const handleGenerateBarcodes = useCallback((selectedJobsData: AccessibleJob[]) => {
    setSelectedJobsForBarcodes(selectedJobsData);
    setShowBarcodeLabels(true);
  }, [setSelectedJobsForBarcodes, setShowBarcodeLabels]);

  return {
    selectedJobsData: getSelectedJobsData(),
    handleBulkCategoryAssign,
    handleBulkStatusUpdate,
    handleBulkMarkCompleted,
    handleBulkDelete,
    handleGenerateBarcodes,
  };
};
