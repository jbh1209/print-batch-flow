
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

interface ProductionJobsContextType {
  // Selection state
  selectedJobs: string[];
  setSelectedJobs: (jobs: string[]) => void;
  selectJob: (jobId: string, selected: boolean) => void;
  selectAllJobs: (jobs: AccessibleJob[], selected: boolean) => void;
  clearSelection: () => void;
  
  // Modal states
  editingJob: AccessibleJob | null;
  setEditingJob: (job: AccessibleJob | null) => void;
  categoryAssignJob: AccessibleJob | null;
  setCategoryAssignJob: (job: AccessibleJob | null) => void;
  customWorkflowJob: AccessibleJob | null;
  setCustomWorkflowJob: (job: AccessibleJob | null) => void;
  showCustomWorkflow: boolean;
  setShowCustomWorkflow: (show: boolean) => void;
  showBarcodeLabels: boolean;
  setShowBarcodeLabels: (show: boolean) => void;
  selectedJobsForBarcodes: AccessibleJob[];
  setSelectedJobsForBarcodes: (jobs: AccessibleJob[]) => void;
}

const ProductionJobsContext = createContext<ProductionJobsContextType | undefined>(undefined);

export const useProductionJobs = () => {
  const context = useContext(ProductionJobsContext);
  if (!context) {
    throw new Error('useProductionJobs must be used within a ProductionJobsProvider');
  }
  return context;
};

interface ProductionJobsProviderProps {
  children: React.ReactNode;
}

export const ProductionJobsProvider: React.FC<ProductionJobsProviderProps> = ({ children }) => {
  // Selection state
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  
  // Modal states
  const [editingJob, setEditingJob] = useState<AccessibleJob | null>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<AccessibleJob | null>(null);
  const [customWorkflowJob, setCustomWorkflowJob] = useState<AccessibleJob | null>(null);
  const [showCustomWorkflow, setShowCustomWorkflow] = useState(false);
  const [showBarcodeLabels, setShowBarcodeLabels] = useState(false);
  const [selectedJobsForBarcodes, setSelectedJobsForBarcodes] = useState<AccessibleJob[]>([]);

  const selectJob = useCallback((jobId: string, selected: boolean) => {
    setSelectedJobs(prev => 
      selected 
        ? [...prev, jobId]
        : prev.filter(id => id !== jobId)
    );
  }, []);

  const selectAllJobs = useCallback((jobs: AccessibleJob[], selected: boolean) => {
    if (selected) {
      setSelectedJobs(jobs.map(job => job.job_id));
    } else {
      setSelectedJobs([]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedJobs([]);
  }, []);

  const value = {
    // Selection state
    selectedJobs,
    setSelectedJobs,
    selectJob,
    selectAllJobs,
    clearSelection,
    
    // Modal states
    editingJob,
    setEditingJob,
    categoryAssignJob,
    setCategoryAssignJob,
    customWorkflowJob,
    setCustomWorkflowJob,
    showCustomWorkflow,
    setShowCustomWorkflow,
    showBarcodeLabels,
    setShowBarcodeLabels,
    selectedJobsForBarcodes,
    setSelectedJobsForBarcodes,
  };

  return (
    <ProductionJobsContext.Provider value={value}>
      {children}
    </ProductionJobsContext.Provider>
  );
};
