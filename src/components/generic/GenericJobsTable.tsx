
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { FileText, Plus } from "lucide-react"; // Added FileText import
import { toast } from "sonner";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import { GenericBatchCreateDialog } from "./GenericBatchCreateDialog";
import { EmptyJobsMessage } from "@/components/flyers/components/EmptyJobsMessage";
import { LoadingSpinner } from "@/components/flyers/components/LoadingSpinner";
import { BatchFixBanner } from "@/components/flyers/components/BatchFixBanner";
import { StatusFilterTabs } from "@/components/flyers/components/StatusFilterTabs";
import { SelectionControls } from "@/components/flyers/components/SelectionControls";
import { JobsTableHeader } from "@/components/flyers/components/JobsTableHeader";
import { GenericJobsTableBody } from "./GenericJobsTableBody";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface GenericJobsTableProps {
  config: ProductConfig;
  jobs: BaseJob[];
  isLoading: boolean;
  error: string | null;
  deleteJob: (id: string) => Promise<boolean>;
  fetchJobs: () => Promise<void>;
  createBatch: (jobs: BaseJob[], properties: any) => Promise<any>;
  isCreatingBatch: boolean;
  fixBatchedJobsWithoutBatch: () => Promise<void>;
  isFixingBatchedJobs?: boolean;
}

export const GenericJobsTable: React.FC<GenericJobsTableProps> = ({
  config,
  jobs,
  isLoading,
  error,
  deleteJob,
  fetchJobs,
  createBatch,
  isCreatingBatch,
  fixBatchedJobsWithoutBatch,
  isFixingBatchedJobs = false
}) => {
  const navigate = useNavigate();
  const [selectedJobs, setSelectedJobs] = useState<BaseJob[]>([]);
  const [filterView, setFilterView] = useState<"all" | "queued" | "batched" | "completed">("all");
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

  // Filter jobs based on current view
  const filteredJobs = filterView === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filterView);

  // Calculate counts for each status
  const filterCounts = {
    all: jobs.length,
    queued: jobs.filter(job => job.status === 'queued').length,
    batched: jobs.filter(job => job.status === 'batched').length,
    completed: jobs.filter(job => job.status === 'completed').length
  };

  // Get only jobs available for selection (queued status)
  const availableJobs = jobs.filter(job => job.status === 'queued');

  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      const jobToAdd = jobs.find(job => job.id === jobId);
      if (jobToAdd && jobToAdd.status === 'queued') {
        setSelectedJobs([...selectedJobs, jobToAdd]);
      }
    } else {
      setSelectedJobs(selectedJobs.filter(job => job.id !== jobId));
    }
  };

  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      // Only select jobs that are in "queued" status
      setSelectedJobs(availableJobs);
    } else {
      setSelectedJobs([]);
    }
  };

  // Handle closing batch dialog
  const handleBatchDialogClose = () => {
    setIsBatchDialogOpen(false);
  };

  // Handle successful batch creation
  const handleBatchSuccess = () => {
    setIsBatchDialogOpen(false);
    setSelectedJobs([]);
    fetchJobs();
    toast.success("Batch created successfully");
  };

  const handleCreateBatch = () => {
    setIsBatchDialogOpen(true);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading jobs</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchJobs}
            >
              Try Again
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8">
        <FileText className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No {config.ui.title.toLowerCase()} jobs found</h3>
        <p className="text-gray-500 text-center mb-4">Get started by creating your first {config.ui.jobFormTitle.toLowerCase()}.</p>
        <Button onClick={() => navigate(config.routes.newJobPath)}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Job
        </Button>
      </div>
    );
  }

  // Count selectable jobs
  const selectableJobsCount = availableJobs.length;

  return (
    <>
      <div className="bg-white rounded-lg border shadow">
        {/* Status filter tabs */}
        <StatusFilterTabs 
          filterView={filterView}
          setFilterView={setFilterView}
          filterCounts={filterCounts}
        />

        {/* Selection controls */}
        <SelectionControls 
          selectedCount={selectedJobs.length}
          totalSelectableCount={selectableJobsCount}
          onCreateBatch={handleCreateBatch}
        />

        {/* Fix Orphaned Jobs Button - only show if there are jobs stuck in batched state */}
        {filterCounts.batched > 0 && (
          <BatchFixBanner 
            onFixJobs={fixBatchedJobsWithoutBatch}
            isFixingBatchedJobs={isFixingBatchedJobs}
          />
        )}

        {/* Jobs Table */}
        <div className="overflow-hidden">
          <Table>
            <JobsTableHeader 
              onSelectAll={handleSelectAllJobs}
              allSelected={selectedJobs.length === selectableJobsCount && selectableJobsCount > 0}
              selectableJobsCount={selectableJobsCount}
            />
            
            <GenericJobsTableBody 
              config={config}
              jobs={filteredJobs}
              selectedJobs={selectedJobs}
              handleSelectJob={handleSelectJob}
              deleteJob={deleteJob}
            />
          </Table>
        </div>
      </div>
      
      {/* Batch Creation Dialog */}
      <GenericBatchCreateDialog
        config={config}
        isOpen={isBatchDialogOpen}
        onClose={handleBatchDialogClose}
        onSuccess={handleBatchSuccess}
        preSelectedJobs={selectedJobs}
        createBatch={createBatch}
        isCreatingBatch={isCreatingBatch}
      />
    </>
  );
};
