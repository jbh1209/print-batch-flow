
import React, { useState, useCallback } from "react";
import { JobSelectionControls } from "./JobSelectionControls";
import { JobsTable } from "./JobsTable";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { WorkflowInitModal } from "./WorkflowInitModal";
import { BulkJobOperations } from "./BulkJobOperations";
import { JobSyncDialog } from "./JobSyncDialog";
import { QRLabelsManager } from "../QRLabelsManager";
import { CustomWorkflowModal } from "./CustomWorkflowModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnhancedJobsTableProps {
  jobs: any[];
  categories: any[];
  onJobUpdated: () => void;
  onJobDeleted: () => void;
  isLoading: boolean;
}

export const EnhancedJobsTable: React.FC<EnhancedJobsTableProps> = ({
  jobs,
  categories,
  onJobUpdated,
  onJobDeleted,
  isLoading
}) => {
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<any>(null);
  const [workflowInitJob, setWorkflowInitJob] = useState<any>(null);
  const [syncingJob, setSyncingJob] = useState<any>(null);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showQRLabels, setShowQRLabels] = useState(false);
  const [showCustomWorkflow, setShowCustomWorkflow] = useState(false);

  const handleSelectJob = useCallback((job: any, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedJobs(jobs);
    } else {
      setSelectedJobs([]);
    }
  }, [jobs]);

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { data, error } = await supabase.rpc('delete_production_jobs', {
        job_ids: [jobId]
      });

      if (error) throw error;
      if (data && !(data as any).success) {
        throw new Error((data as any).error || 'Failed to delete job');
      }

      toast.success('Job deleted successfully');
      onJobDeleted();
      
      // Clear selection if deleted job was selected
      setSelectedJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  };

  const handleWorkflowInitialize = async (job: any, categoryId: string) => {
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
      onJobUpdated();
    } catch (err) {
      console.error('Error initializing workflow:', err);
      toast.error('Failed to initialize workflow');
    }
  };

  const handleCustomWorkflow = () => {
    if (selectedJobs.length !== 1) {
      toast.error("Custom workflows can only be created for individual jobs");
      return;
    }
    setShowCustomWorkflow(true);
  };

  const handleCustomWorkflowSuccess = () => {
    setShowCustomWorkflow(false);
    setSelectedJobs([]);
    onJobUpdated();
  };

  // Simplified modal close handlers
  const handleEditModalClose = useCallback(() => {
    setEditingJob(null);
  }, []);

  const handleEditModalSave = useCallback(() => {
    setEditingJob(null);
    onJobUpdated();
  }, [onJobUpdated]);

  const handleCategoryAssignModalClose = useCallback(() => {
    setCategoryAssignJob(null);
  }, []);

  const handleCategoryAssignModalSave = useCallback(() => {
    setCategoryAssignJob(null);
    onJobUpdated();
  }, [onJobUpdated]);

  const handleWorkflowInitModalClose = useCallback(() => {
    setWorkflowInitJob(null);
  }, []);

  if (isLoading) {
    return <div className="text-center py-8">Loading jobs...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <JobSelectionControls
          selectedJobsCount={selectedJobs.length}
          onBulkOperations={() => setShowBulkOperations(true)}
          onQRLabels={() => setShowQRLabels(true)}
          onClearSelection={() => setSelectedJobs([])}
          onCustomWorkflow={handleCustomWorkflow}
          selectedJobs={selectedJobs}
        />

        <JobsTable
          jobs={jobs}
          selectedJobs={selectedJobs}
          onSelectJob={handleSelectJob}
          onSelectAll={handleSelectAll}
          onJobUpdate={onJobUpdated}
          onEditJob={setEditingJob}
          onSyncJob={setSyncingJob}
          onCategoryAssign={setCategoryAssignJob}
          onWorkflowInit={setWorkflowInitJob}
          onDeleteJob={handleDeleteJob}
        />
      </div>

      {/* Modals */}
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={handleEditModalClose}
          onSave={handleEditModalSave}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={handleCategoryAssignModalClose}
          onAssign={handleCategoryAssignModalSave}
        />
      )}

      {workflowInitJob && (
        <WorkflowInitModal
          job={workflowInitJob}
          categories={categories}
          onClose={handleWorkflowInitModalClose}
          onInitialize={handleWorkflowInitialize}
        />
      )}

      <BulkJobOperations
        isOpen={showBulkOperations}
        onClose={() => setShowBulkOperations(false)}
        selectedJobs={selectedJobs}
        categories={categories}
        onOperationComplete={() => {
          setSelectedJobs([]);
          onJobUpdated();
        }}
      />

      <JobSyncDialog
        isOpen={!!syncingJob}
        onClose={() => setSyncingJob(null)}
        job={syncingJob}
        onJobUpdated={onJobUpdated}
      />

      {showQRLabels && (
        <QRLabelsManager
          selectedJobs={selectedJobs}
          onClose={() => setShowQRLabels(false)}
        />
      )}

      {showCustomWorkflow && selectedJobs.length === 1 && (
        <CustomWorkflowModal
          isOpen={showCustomWorkflow}
          onClose={() => setShowCustomWorkflow(false)}
          job={selectedJobs[0]}
          onSuccess={handleCustomWorkflowSuccess}
        />
      )}
    </>
  );
};
