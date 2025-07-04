import { useState, useEffect } from "react";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { toast } from "sonner";
import { FlyerJobsTableContainer } from "./FlyerJobsTableContainer";
import { Table } from "@/components/ui/table";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { FlyerJobsEmptyState } from "./components/FlyerJobsEmptyState";
import { StatusFilterTabs } from "./components/StatusFilterTabs";
import { SelectionControls } from "./components/SelectionControls";
import { BatchFixBanner } from "./components/BatchFixBanner";
import { JobsTableHeader } from "./components/JobsTableHeader";
import { FlyerJobsBody } from "./components/FlyerJobsBody";
import { useJobSpecificationDisplay } from "@/hooks/useJobSpecificationDisplay";

export const FlyerJobsTable = () => {
  const navigate = useNavigate();
  const { 
    jobs, 
    isLoading, 
    error, 
    fetchJobs, 
    fixBatchedJobsWithoutBatch, 
    isFixingBatchedJobs,
    createBatch,
    isCreatingBatch
  } = useFlyerJobs();

  // State for job selection and filtering
  const [selectedJobs, setSelectedJobs] = useState<FlyerJob[]>([]);
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

  // Validate job compatibility for batching using specifications
  const validateJobsForBatching = async (jobs: FlyerJob[]) => {
    if (jobs.length === 0) {
      return { isValid: false, error: "No jobs selected" };
    }

    // Since specifications are now dynamic, we'll validate they exist
    // but allow mixed specifications with a warning
    return { isValid: true, error: null };
  };

  // Direct batch creation without modal
  const handleCreateBatch = async () => {
    const validation = await validateJobsForBatching(selectedJobs);
    
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    try {      
      // Auto-determine batch properties from selected jobs
      const batchProperties = {
        paperType: 'Standard Paper', // Default since specs are now dynamic
        paperWeight: 'Standard Weight',
        laminationType: 'none' as const,
        printerType: 'HP 12000',
        sheetSize: '530x750mm',
        slaTargetDays: 3 // Default SLA for flyers
      };

      await createBatch(selectedJobs, batchProperties);
      
      // Clear selection after successful batch creation
      setSelectedJobs([]);
      
    } catch (error) {
      console.error('Error creating batch:', error);
      // Error handling is already done in the createBatch function
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (jobs.length === 0) {
    return <FlyerJobsEmptyState />;
  }

  // Count selectable jobs
  const selectableJobsCount = availableJobs.length;

  return (
    <div className="bg-white rounded-lg border shadow">
      {/* Status filter tabs */}
      <StatusFilterTabs 
        filterView={filterView}
        setFilterView={setFilterView}
        filterCounts={filterCounts}
      />

      {/* Selection controls with direct batch creation */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            {selectedJobs.length} of {selectableJobsCount} jobs selected
          </div>
          <Button 
            onClick={() => navigate("/batchflow/batches/flyers/jobs/new")}
            variant="outline"
            size="sm"
          >
            Create New Job
          </Button>
        </div>
        <Button 
          onClick={handleCreateBatch} 
          disabled={selectedJobs.length === 0 || isCreatingBatch}
        >
          {isCreatingBatch ? "Creating Batch..." : "Create Batch"}
        </Button>
      </div>

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
  );
};
