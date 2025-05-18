
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FlyerJobsEmptyState } from "@/components/flyers/components/FlyerJobsEmptyState";
import GenericJobsTableBody from "./GenericJobsTableBody";
import { SelectionControls } from "@/components/flyers/components/SelectionControls";
import { BatchFixBanner } from "@/components/flyers/components/BatchFixBanner";
import { GenericBatchCreateDialog } from "./GenericBatchCreateDialog";
import { Plus } from "lucide-react";

interface GenericJobsTableProps {
  config: ProductConfig;
  jobs: BaseJob[];
  isLoading: boolean;
  error: string | null;
  deleteJob: (id: string) => Promise<boolean>;
  fetchJobs: () => Promise<void>;
  createBatch: (jobs: BaseJob[], properties: any) => Promise<any>;
  isCreatingBatch: boolean;
  fixBatchedJobsWithoutBatch: () => Promise<number | void>;
  isFixingBatchedJobs?: boolean;
  onEditJob?: (jobId: string) => void;
  onViewJob?: (jobId: string) => void;
}

const GenericJobsTable: React.FC<GenericJobsTableProps> = ({
  config,
  jobs,
  isLoading,
  error,
  deleteJob,
  fetchJobs,
  createBatch,
  isCreatingBatch,
  fixBatchedJobsWithoutBatch,
  isFixingBatchedJobs,
  onEditJob,
  onViewJob,
}) => {
  const navigate = useNavigate();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  // Handle selecting all jobs
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs(jobs.filter(job => job.status === 'queued').map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  // Handle selecting individual job
  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  // Get selected job objects
  const getSelectedJobObjects = () => {
    return jobs.filter(job => selectedJobs.includes(job.id));
  };

  // Handle job edit
  const handleEditJob = (jobId: string) => {
    if (onEditJob) {
      onEditJob(jobId);
    }
  };

  // Handle job view
  const handleViewJob = (jobId: string) => {
    if (onViewJob) {
      onViewJob(jobId);
    }
  };

  // Handle job deletion
  const handleDeleteJob = async (jobId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this job? This action cannot be undone.");
    if (confirmed) {
      const success = await deleteJob(jobId);
      if (success) {
        setSelectedJobs(prev => prev.filter(id => id !== jobId));
        toast.success("Job deleted successfully");
      }
    }
  };

  // Handle create batch
  const handleCreateBatch = () => {
    setShowBatchDialog(true);
  };

  // Handle batch dialog close
  const handleBatchDialogClose = () => {
    setShowBatchDialog(false);
  };

  // Handle batch success
  const handleBatchSuccess = () => {
    setShowBatchDialog(false);
    setSelectedJobs([]);
    fetchJobs();
    toast.success(`Batch created successfully with ${selectedJobs.length} jobs`);
  };

  // Check if all queued jobs are selected
  const areAllQueuedJobsSelected = () => {
    const queuedJobs = jobs.filter(job => job.status === 'queued');
    return queuedJobs.length > 0 && queuedJobs.every(job => selectedJobs.includes(job.id));
  };

  // Count queued jobs
  const countQueuedJobs = () => jobs.filter(job => job.status === 'queued').length;

  // Count batched jobs (for orphaned jobs banner)
  const countBatchedJobs = () => jobs.filter(job => job.status === 'batched').length;

  // If there are no jobs, show empty state
  if (jobs.length === 0) {
    return <FlyerJobsEmptyState productType={config.productType} />;
  }

  return (
    <div className="bg-white rounded-lg border shadow">
      {/* Selection controls - shows selected job count and batch button */}
      <SelectionControls 
        selectedCount={selectedJobs.length}
        totalSelectableCount={countQueuedJobs()}
        onCreateBatch={handleCreateBatch}
      />

      {/* Fix Orphaned Jobs Banner - only show if there are jobs stuck in batched state */}
      {countBatchedJobs() > 0 && (
        <BatchFixBanner 
          onFixJobs={fixBatchedJobsWithoutBatch}
          isFixingBatchedJobs={isFixingBatchedJobs || false}
        />
      )}
      
      {/* Jobs Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Job #</TableHead>
              {config.hasSize && <TableHead>Size</TableHead>}
              {config.productType === "Sleeves" ? 
                <TableHead>Stock Type</TableHead> : 
                <TableHead>Paper</TableHead>
              }
              <TableHead>Quantity</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <GenericJobsTableBody 
            jobs={jobs}
            config={config}
            selectedJobs={selectedJobs}
            onSelectJob={handleSelectJob}
            onDeleteJob={handleDeleteJob}
            onEditJob={handleEditJob}
            onViewJob={handleViewJob}
          />
        </Table>
      </div>

      {/* Batch Creation Dialog */}
      <GenericBatchCreateDialog
        config={config}
        isOpen={showBatchDialog}
        onClose={handleBatchDialogClose}
        onSuccess={handleBatchSuccess}
        preSelectedJobs={getSelectedJobObjects()}
        createBatch={createBatch}
        isCreatingBatch={isCreatingBatch}
      />

      {/* Add button for adding new jobs */}
      <div className="p-4 border-t flex justify-end">
        <Button 
          onClick={() => navigate(config.routes.newJobPath)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add New {config.productType} Job
        </Button>
      </div>
    </div>
  );
};

export default GenericJobsTable;
