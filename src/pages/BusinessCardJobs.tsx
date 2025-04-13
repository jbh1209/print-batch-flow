
import { useNavigate } from "react-router-dom"; 
import JobsHeader from "@/components/business-cards/JobsHeader";
import StatusFilterTabs from "@/components/business-cards/StatusFilterTabs";
import JobsTableContainer from "@/components/business-cards/JobsTableContainer";
import FilterBar from "@/components/business-cards/FilterBar";
import { useBusinessCardJobsList } from "@/hooks/useBusinessCardJobsList";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const BusinessCardJobs = () => {
  const navigate = useNavigate();
  const { 
    jobs, 
    isLoading, 
    filterView, 
    filterCounts, 
    laminationFilter, 
    selectedJobs,
    isFixingBatchedJobs,
    setFilterView, 
    setLaminationFilter, 
    fetchJobs, 
    fixBatchedJobsWithoutBatch,
    handleSelectJob, 
    handleSelectAllJobs,
    getSelectedJobObjects
  } = useBusinessCardJobsList();
  
  // Handle batch completion
  const handleBatchComplete = () => {
    fetchJobs(); // Refresh the jobs list
  };

  return (
    <div>
      <JobsHeader 
        title="All Business Card Jobs" 
        subtitle="View and manage all business card jobs" 
      />
      
      <div className="bg-white rounded-lg border shadow mb-8">
        {/* Tabs */}
        <StatusFilterTabs 
          filterView={filterView} 
          filterCounts={filterCounts} 
          setFilterView={setFilterView} 
        />
        
        {/* Filter Bar */}
        <FilterBar 
          laminationFilter={laminationFilter}
          setLaminationFilter={setLaminationFilter}
          selectedJobs={getSelectedJobObjects()}
          allAvailableJobs={jobs}
          onBatchComplete={handleBatchComplete}
          onSelectJob={handleSelectJob}
        />
        
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
              onClick={fixBatchedJobsWithoutBatch}
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
        
        {/* Jobs Table */}
        <JobsTableContainer 
          jobs={jobs}
          isLoading={isLoading}
          onRefresh={fetchJobs}
          selectedJobs={selectedJobs}
          onSelectJob={handleSelectJob}
          onSelectAllJobs={handleSelectAllJobs}
        />
      </div>
    </div>
  );
};

export default BusinessCardJobs;
