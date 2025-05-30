
import React, { useState } from "react";
import { JobSelectionControls } from "./JobSelectionControls";
import { JobsTable } from "./JobsTable";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { WorkflowInitModal } from "./WorkflowInitModal";
import { BulkJobOperations } from "./BulkJobOperations";
import { JobSyncDialog } from "./JobSyncDialog";
import { QRLabelsManager } from "../QRLabelsManager";
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

  const handleSelectJob = (job: any, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedJobs(jobs);
    } else {
      setSelectedJobs([]);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      onJobDeleted();
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  };

  const handleWorkflowInitialize = async (job: any, categoryId: string) => {
    try {
      // Update job with category
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
          onClose={() => setEditingJob(null)}
          onSave={onJobUpdated}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={onJobUpdated}
        />
      )}

      {workflowInitJob && (
        <WorkflowInitModal
          job={workflowInitJob}
          categories={categories}
          onClose={() => setWorkflowInitJob(null)}
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

      <QRLabelsManager
        selectedJobs={selectedJobs}
        onClose={() => setShowQRLabels(false)}
      />
    </>
  );
};
