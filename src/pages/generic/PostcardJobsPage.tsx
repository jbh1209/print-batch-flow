
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Plus, FileUp } from "lucide-react";
import GenericJobsTable from "@/components/generic/GenericJobsTable";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import { GenericBatchCreateDialog } from '@/components/generic/GenericBatchCreateDialog';
import { productConfigs } from '@/config/productTypes';

const PostcardJobsPage = () => {
  const navigate = useNavigate();
  const config = productConfigs["Postcards"];
  const {
    jobs,
    isLoading,
    error,
    deleteJob,
    createBatch,
    isCreatingBatch,
    fetchJobs,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  } = useGenericJobs(config);

  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);

  const handleNewJob = () => {
    navigate(config.routes.newJobPath);
  };

  const handleViewJob = (jobId: string) => {
    console.log("Navigating to job details:", jobId);
    if (config.routes.jobDetailPath) {
      const path = config.routes.jobDetailPath(jobId);
      console.log("Navigation path:", path);
      navigate(path);
    } else {
      console.error("No jobDetailPath route defined in config");
    }
  };

  const handleSelectionChange = (jobs: any[]) => {
    setSelectedJobs(jobs);
  };

  const handleCreateBatch = (jobs: any[]) => {
    setSelectedJobs(jobs);
    setIsBatchDialogOpen(true);
  };

  const handleBatchCreated = () => {
    setIsBatchDialogOpen(false);
  };

  return (
    <div className="container mx-auto py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{config.ui.title || "Postcard"} Jobs</h1>
        <div className="flex space-x-2">
          <Button onClick={() => handleCreateBatch(jobs.filter(job => job.status === 'queued'))}>
            <FileUp className="mr-2 h-4 w-4" />
            Batch Jobs
          </Button>
          <Button onClick={handleNewJob}>
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </Button>
        </div>
      </div>

      <GenericJobsTable
        jobs={jobs}
        isLoading={isLoading}
        error={error}
        deleteJob={deleteJob}
        fetchJobs={fetchJobs}
        createBatch={createBatch}
        isCreatingBatch={isCreatingBatch}
        fixBatchedJobsWithoutBatch={fixBatchedJobsWithoutBatch}
        isFixingBatchedJobs={isFixingBatchedJobs}
        config={config}
        onViewJob={handleViewJob}
      />

      <GenericBatchCreateDialog
        config={config}
        isOpen={isBatchDialogOpen}
        onClose={() => setIsBatchDialogOpen(false)}
        onSuccess={handleBatchCreated}
        preSelectedJobs={selectedJobs}
        createBatch={createBatch}
        isCreatingBatch={isCreatingBatch}
      />
    </div>
  );
};

export default PostcardJobsPage;
