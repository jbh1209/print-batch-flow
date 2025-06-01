
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useResponsiveJobsTable = (refreshJobs: () => void) => {
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Column filters state
  const [columnFilters, setColumnFilters] = useState({
    woNumber: '',
    customer: '',
    reference: '',
    category: '',
    status: '',
    dueDate: '',
    currentStage: ''
  });
  
  // Modal states
  const [editingJob, setEditingJob] = useState<any>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<any>(null);
  const [workflowInitJob, setWorkflowInitJob] = useState<any>(null);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showQRLabels, setShowQRLabels] = useState(false);

  const handleSelectJob = useCallback((job: any, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  }, []);

  const handleSelectAll = useCallback((selected: boolean, jobs: any[]) => {
    if (selected) {
      setSelectedJobs(jobs);
    } else {
      setSelectedJobs([]);
    }
  }, []);

  const handleColumnFilterChange = useCallback((key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleClearColumnFilters = useCallback(() => {
    setColumnFilters({
      woNumber: '',
      customer: '',
      reference: '',
      category: '',
      status: '',
      dueDate: '',
      currentStage: ''
    });
  }, []);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder]);

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
      setSelectedJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  }, [refreshJobs]);

  const handleBulkStatusUpdate = useCallback(async (newStatus: string) => {
    if (selectedJobs.length === 0) return;

    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedJobs.map(j => j.id));

      if (error) throw error;

      toast.success(`Successfully updated ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''} to ${newStatus}`);
      setSelectedJobs([]);
      refreshJobs();
    } catch (err) {
      console.error('Error updating job status:', err);
      toast.error('Failed to update job status');
    }
  }, [selectedJobs, refreshJobs]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedJobs.length === 0) return;

    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', selectedJobs.map(j => j.id));

      if (error) throw error;

      toast.success(`Successfully deleted ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''}`);
      setSelectedJobs([]);
      refreshJobs();
    } catch (err) {
      console.error('Error deleting jobs:', err);
      toast.error('Failed to delete jobs');
    }
  }, [selectedJobs, refreshJobs]);

  const handleCustomWorkflow = useCallback(() => {
    toast.info('Custom workflow feature coming soon');
  }, []);

  return {
    // State
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
