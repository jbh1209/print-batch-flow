
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/table";
import { FlyerJobsEmptyState } from "@/components/flyers/components/FlyerJobsEmptyState";
import GenericJobsTableBody from "./GenericJobsTableBody";
import { Checkbox } from "@/components/ui/checkbox";

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
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onSelectAllJobs: (isSelected: boolean) => void;
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
  selectedJobs,
  onSelectJob,
  onSelectAllJobs,
}) => {
  const navigate = useNavigate();
  console.log(`GenericJobsTable for ${config.productType} rendering with ${jobs.length} jobs`);
  console.log(`Selected jobs IDs (${selectedJobs.length}):`, selectedJobs);

  // Count queued jobs
  const queuedJobs = jobs.filter(job => job.status === 'queued');
  const queuedJobsCount = queuedJobs.length;
  
  useEffect(() => {
    console.log(`Product: ${config.productType} - Queued jobs: ${queuedJobsCount}, Selected jobs: ${selectedJobs.length}`);
  }, [queuedJobsCount, selectedJobs, config.productType]);
  
  // Check if all queued jobs are selected
  const areAllQueuedJobsSelected = queuedJobs.length > 0 && 
    queuedJobs.every(job => selectedJobs.includes(job.id));

  // Handle job deletion
  const handleDeleteJob = async (jobId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this job? This action cannot be undone.");
    if (confirmed) {
      const success = await deleteJob(jobId);
      if (success) {
        toast.success("Job deleted successfully");
      }
    }
  };

  // Add specific debug UI element to verify the component is rendering correctly
  const renderDebugInfo = () => {
    return (
      <div className="p-2 text-xs text-gray-500 border-t border-dashed">
        {config.productType} UI version: {Date.now()}
      </div>
    );
  };

  // If there are no jobs, show empty state
  if (jobs.length === 0) {
    return (
      <>
        <FlyerJobsEmptyState productType={config.productType} />
        {renderDebugInfo()}
      </>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox 
                checked={areAllQueuedJobsSelected && queuedJobsCount > 0}
                onCheckedChange={(checked) => {
                  console.log(`${config.productType} - Select all checkbox changed:`, checked);
                  onSelectAllJobs(!!checked);
                }}
                disabled={queuedJobsCount === 0}
                aria-label={`Select all ${queuedJobsCount} queued jobs`}
              />
            </TableHead>
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
          onSelectJob={onSelectJob}
          onDeleteJob={handleDeleteJob}
          onEditJob={onEditJob}
          onViewJob={onViewJob}
        />
      </Table>
      {renderDebugInfo()}
    </div>
  );
};

export default GenericJobsTable;
