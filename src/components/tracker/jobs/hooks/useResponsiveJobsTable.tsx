
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useJobTableState } from "@/hooks/tracker/useJobTableState";

export const useResponsiveJobsTable = (refreshJobs: () => void) => {
  const tableState = useJobTableState();

  const handleSelectJob = useCallback((job: any, selected: boolean) => {
    if (selected) {
      tableState.setSelectedJobs(prev => [...prev, job]);
    } else {
      tableState.setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  }, [tableState.setSelectedJobs]);

  const handleSelectAll = useCallback((selected: boolean, jobs: any[]) => {
    if (selected) {
      tableState.setSelectedJobs(jobs);
    } else {
      tableState.setSelectedJobs([]);
    }
  }, [tableState.setSelectedJobs]);

  const handleColumnFilterChange = useCallback((key: string, value: string) => {
    tableState.setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, [tableState.setColumnFilters]);

  const handleClearColumnFilters = useCallback(() => {
    tableState.setColumnFilters({
      woNumber: '',
      customer: '',
      reference: '',
      category: '',
      status: '',
      dueDate: '',
      currentStage: ''
    });
  }, [tableState.setColumnFilters]);

  const handleSort = useCallback((field: string) => {
    if (tableState.sortField === field) {
      tableState.setSortOrder(tableState.sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      tableState.setSortField(field);
      tableState.setSortOrder('asc');
    }
  }, [tableState.sortField, tableState.sortOrder, tableState.setSortField, tableState.setSortOrder]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      refreshJobs();
      
      // Clear selection if deleted job was selected
      tableState.setSelectedJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  }, [refreshJobs, tableState.setSelectedJobs]);

  const handleBulkStatusUpdate = useCallback(async (newStatus: string) => {
    if (tableState.selectedJobs.length === 0) return;

    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .in('id', tableState.selectedJobs.map(j => j.id));

      if (error) throw error;

      toast.success(`Successfully updated ${tableState.selectedJobs.length} job${tableState.selectedJobs.length > 1 ? 's' : ''} to ${newStatus}`);
      tableState.setSelectedJobs([]);
      refreshJobs();
    } catch (err) {
      console.error('Error updating job status:', err);
      toast.error('Failed to update job status');
    }
  }, [tableState.selectedJobs, refreshJobs, tableState.setSelectedJobs]);

  const handleBulkDelete = useCallback(async () => {
    if (tableState.selectedJobs.length === 0) return;

    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', tableState.selectedJobs.map(j => j.id));

      if (error) throw error;

      toast.success(`Successfully deleted ${tableState.selectedJobs.length} job${tableState.selectedJobs.length > 1 ? 's' : ''}`);
      tableState.setSelectedJobs([]);
      refreshJobs();
    } catch (err) {
      console.error('Error deleting jobs:', err);
      toast.error('Failed to delete jobs');
    }
  }, [tableState.selectedJobs, refreshJobs, tableState.setSelectedJobs]);

  const handleCustomWorkflow = useCallback(() => {
    toast.info('Custom workflow feature coming soon');
  }, []);

  return {
    // Spread all table state
    ...tableState,
    
    // Handlers
    handleSelectJob,
    handleSelectAll,
    handleColumnFilterChange,
    handleClearColumnFilters,
    handleSort,
    handleDeleteJob,
    handleBulkStatusUpdate,
    handleBulkDelete,
    handleCustomWorkflow
  };
};
