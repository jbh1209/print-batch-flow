
import { useState } from "react";

export const useJobsTableState = () => {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  
  // Modal states
  const [editingJob, setEditingJob] = useState<any>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<any>(null);

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

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleSelectAll = (checked: boolean, jobs: any[]) => {
    if (checked) {
      setSelectedJobs(jobs.map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearColumnFilters = () => {
    setColumnFilters({
      woNumber: '',
      customer: '',
      reference: '',
      category: '',
      status: '',
      dueDate: '',
      currentStage: ''
    });
  };

  return {
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
    setSortField,
    sortOrder,
    setSortOrder,
    columnFilters,
    setColumnFilters,
    handleSelectJob,
    handleSelectAll,
    handleSort,
    handleColumnFilterChange,
    handleClearColumnFilters
  };
};
