
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
import { productConfigs } from "@/config/productTypes";

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

  const handleCreateBatch = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Please select at least one job to create a batch");
      return;
    }
    
    try {
      // Get the flyers config for default values
      const flyersConfig = productConfigs["Flyers"];
      
      // Determine common properties from selected jobs
      const commonPaperType = findCommonProperty(selectedJobs, 'paper_type');
      const commonPaperWeight = findCommonProperty(selectedJobs, 'paper_weight');
      
      // Show creating batch toast
      toast.loading("Creating batch with " + selectedJobs.length + " jobs...");
      
      // Create the batch with automatically determined properties
      const batch = await createBatch(selectedJobs, {
        // Use common properties when available, otherwise use defaults from config
        paperType: commonPaperType || flyersConfig.availablePaperTypes[0],
        paperWeight: commonPaperWeight || flyersConfig.availablePaperWeights[0],
        laminationType: "none",
        printerType: "HP 12000",
        sheetSize: "530x750mm",
        slaTargetDays: flyersConfig.slaTargetDays
      });
      
      // Clear selection and refresh the jobs list
      setSelectedJobs([]);
      await fetchJobs();
      
      // Dismiss loading toast and show success message with the batch name
      toast.dismiss();
      toast.success(`Batch ${batch.name} created with ${selectedJobs.length} jobs`);
      
      // Navigate to the newly created batch details
      navigate(`/batches/flyers/batches/${batch.id}`);
    } catch (error) {
      console.error("Error creating batch:", error);
      toast.dismiss();
      toast.error("Failed to create batch. Please try again.");
    }
  };
  
  // Helper function to find common property among jobs
  const findCommonProperty = (jobs: FlyerJob[], property: keyof FlyerJob): string | null => {
    if (jobs.length === 0) return null;
    
    const firstValue = jobs[0][property];
    const allSame = jobs.every(job => job[property] === firstValue);
    
    return allSame ? String(firstValue) : null;
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
          isCreatingBatch={isCreatingBatch}
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
    </>
  );
};
