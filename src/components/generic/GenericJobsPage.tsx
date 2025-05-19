
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import type { BatchFixOperationResult } from "@/config/types/baseTypes";
import GenericJobsTable from "./GenericJobsTable";

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
    fixBatchedJobsWithoutBatch: () => Promise<number>;
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
      
      <div className="mt-4">
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
        />
      </div>
    </div>
  );
};

export default GenericJobsPage;
