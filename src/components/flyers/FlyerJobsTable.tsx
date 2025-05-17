
import { useState, useEffect } from "react";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { toast } from "sonner";
import { FlyerJobsTableContainer } from "./FlyerJobsTableContainer";
import { FlyerBatchCreateDialog } from "./FlyerBatchCreateDialog";
import { Table } from "@/components/ui/table";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { FlyerJobsEmptyState } from "./components/FlyerJobsEmptyState";
import { StatusFilterTabs } from "./components/StatusFilterTabs";
import { SelectionControls } from "./components/SelectionControls";
import { BatchFixBanner } from "./components/BatchFixBanner";
import { JobsTableHeader } from "./components/JobsTableHeader";
import { FlyerJobsBody } from "./components/FlyerJobsBody";

export const FlyerJobsTable = () => {
  const navigate = useNavigate();
  const { 
    jobs, 
    isLoading, 
    error, 
    fetchJobs, 
    fixBatchedJobsWithoutBatch, 
    isFixingBatchedJobs 
  } = useFlyerJobs();

  // State for job selection and filtering
  const [selectedJobs, setSelectedJobs] = useState<FlyerJob[]>([]);
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

  if (jobs.length === 0) {
    return <FlyerJobsEmptyState productType="Flyers" />;
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
        <FlyerJobsTableContainer>
          <Table>
            <JobsTableHeader 
              onSelectAll={handleSelectAllJobs}
              allSelected={selectedJobs.length === selectableJobsCount && selectableJobsCount > 0}
              selectableJobsCount={selectableJobsCount}
            />
            <FlyerJobsBody 
              jobs={filteredJobs}
              selectedJobs={selectedJobs}
              handleSelectJob={handleSelectJob}
            />
          </Table>
        </FlyerJobsTableContainer>
      </div>
      
      {/* Batch Creation Dialog */}
      <FlyerBatchCreateDialog
        isOpen={isBatchDialogOpen}
        onClose={handleBatchDialogClose}
        onSuccess={handleBatchSuccess}
        preSelectedJobs={selectedJobs}
      />
    </>
  );
};
