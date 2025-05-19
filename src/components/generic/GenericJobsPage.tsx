
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2, AlertCircle } from "lucide-react";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import GenericJobsTable from "./GenericJobsTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
      
      <div className="mt-4">
        {isLoading ? (
          renderLoadingState()
        ) : (
          <GenericJobsTable 
            config={config}
            jobs={jobs}
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
          />
        )}
      </div>
    </div>
  );
};

export default GenericJobsPage;
