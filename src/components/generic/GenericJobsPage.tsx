
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2, AlertCircle } from "lucide-react";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import GenericJobsTable from "./GenericJobsTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GenericBatchCreateDialog } from './GenericBatchCreateDialog';

interface GenericJobsPageProps {
  config: ProductConfig;
  useJobsHook: () => {
    jobs: BaseJob[];
    isLoading: boolean;
    error: string | null;
    deleteJob: (id: string) => Promise<boolean>;
    fetchJobs: () => Promise<void>;
    createBatch: (jobs: BaseJob[], properties: any) => Promise<any>;
    isCreatingBatch: boolean;
    fixBatchedJobsWithoutBatch: () => Promise<number | void>;
    isFixingBatchedJobs?: boolean;
  };
}

const GenericJobsPage: React.FC<GenericJobsPageProps> = ({ config, useJobsHook }) => {
  const navigate = useNavigate();
  const {
    jobs,
    isLoading,
    error,
    deleteJob,
    fetchJobs,
    createBatch,
    isCreatingBatch,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  } = useJobsHook();

  // State for job selection and batch creation
  const [selectedJobs, setSelectedJobs] = useState<BaseJob[]>([]);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [filterView, setFilterView] = useState<"all" | "queued" | "batched" | "completed">("all");

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

  // Handle job selection
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

  // Handle select all jobs
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      // Only select jobs that are in "queued" status
      setSelectedJobs(jobs.filter(job => job.status === 'queued'));
    } else {
      setSelectedJobs([]);
    }
  };

  // Error state handling
  const renderErrorState = () => {
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
  };

  // Loading state handling
  const renderLoadingState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-gray-300 mb-4" />
        <h3 className="font-medium text-lg mb-1">Loading jobs...</h3>
        <p className="text-sm text-gray-400">Please wait while we fetch your data</p>
      </div>
    );
  };

  // Handle edit job action
  const handleEditJob = (jobId: string) => {
    navigate(config.routes.jobEditPath(jobId));
  };

  // Handle view job action
  const handleViewJob = (jobId: string) => {
    navigate(config.routes.jobDetailPath(jobId));
  };

  // Handle batch creation action
  const handleCreateBatch = () => {
    if (selectedJobs.length > 0) {
      setIsBatchDialogOpen(true);
    }
  };

  // Handle batch dialog close
  const handleBatchDialogClose = () => {
    setIsBatchDialogOpen(false);
  };

  // Handle successful batch creation
  const handleBatchSuccess = () => {
    setIsBatchDialogOpen(false);
    setSelectedJobs([]);
    fetchJobs();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <FileText className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{config.ui.title} Jobs</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage print jobs for {config.ui.title.toLowerCase()}</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => navigate(config.routes.basePath)}
          >
            Back to {config.ui.title}
          </Button>
          <Button
            onClick={() => navigate(config.routes.newJobPath)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Job
          </Button>
        </div>
      </div>
      
      {error && renderErrorState()}
      
      <div className="bg-white rounded-lg border shadow mb-8">
        {/* Status Filter Tabs */}
        <div className="flex border-b">
          <button
            className={`px-4 py-3 text-sm font-medium ${filterView === 'all' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('all')}
          >
            All Jobs ({filterCounts.all})
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${filterView === 'queued' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('queued')}
          >
            Queued ({filterCounts.queued})
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${filterView === 'batched' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('batched')}
          >
            Batched ({filterCounts.batched})
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${filterView === 'completed' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('completed')}
          >
            Completed ({filterCounts.completed})
          </button>
        </div>
        
        {/* Selection Controls */}
        <div className="border-b p-3 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedJobs.length > 0 ? (
              <span>{selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected</span>
            ) : (
              <span>Select jobs to batch</span>
            )}
          </div>
          <div>
            <Button
              size="sm"
              onClick={handleCreateBatch}
              disabled={selectedJobs.length === 0}
            >
              Create Batch
            </Button>
          </div>
        </div>

        {/* Fix Orphaned Jobs Button - only show if there are jobs stuck in batched state */}
        {filterCounts.batched > 0 && (
          <div className="border-t p-3 bg-amber-50 flex justify-between items-center">
            <div className="text-sm text-amber-800">
              <span className="font-medium">Note:</span> Some jobs may be stuck in "batched" status after a batch was deleted.
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white"
              onClick={() => fixBatchedJobsWithoutBatch()}
              disabled={isFixingBatchedJobs}
            >
              {isFixingBatchedJobs ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Fixing...
                </>
              ) : (
                'Fix Orphaned Jobs'
              )}
            </Button>
          </div>
        )}
        
        <div className="mt-4">
          {isLoading ? (
            renderLoadingState()
          ) : (
            <GenericJobsTable 
              config={config}
              jobs={filteredJobs}
              isLoading={isLoading}
              error={error}
              deleteJob={deleteJob}
              fetchJobs={fetchJobs}
              createBatch={createBatch}
              isCreatingBatch={isCreatingBatch}
              fixBatchedJobsWithoutBatch={fixBatchedJobsWithoutBatch}
              isFixingBatchedJobs={isFixingBatchedJobs}
              onEditJob={handleEditJob}
              onViewJob={handleViewJob}
              selectedJobs={selectedJobs.map(job => job.id)}
              onSelectJob={handleSelectJob}
              onSelectAllJobs={handleSelectAllJobs}
            />
          )}
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
    </div>
  );
};

export default GenericJobsPage;
