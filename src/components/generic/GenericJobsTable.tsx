import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FlyerJobsEmptyState } from "@/components/flyers/components/FlyerJobsEmptyState";
import GenericJobsTableBody from "./GenericJobsTableBody";

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
  
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs(jobs.filter(job => job.status === 'queued').map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const getSelectedJobObjects = () => {
    return jobs.filter(job => selectedJobs.includes(job.id));
  };

  const handleEditJob = (jobId: string) => {
    if (onEditJob) {
      onEditJob(jobId);
    }
  };

  const handleViewJob = (jobId: string) => {
    if (onViewJob) {
      onViewJob(jobId);
    }
  };

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

  const areAllQueuedJobsSelected = () => {
    const queuedJobs = jobs.filter(job => job.status === 'queued');
    return queuedJobs.length > 0 && queuedJobs.every(job => selectedJobs.includes(job.id));
  };

  const countQueuedJobs = () => jobs.filter(job => job.status === 'queued').length;

  if (jobs.length === 0) {
    return <FlyerJobsEmptyState productType={config.productType} />;
  }

  return (
    <div>
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
  );
};

export default GenericJobsTable;
