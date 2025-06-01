
import { useState } from "react";

export const useJobTableState = () => {
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
    setShowQRLabels
  };
};
