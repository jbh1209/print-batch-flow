
import { useNavigate } from "react-router-dom"; 
import JobsHeader from "@/components/business-cards/JobsHeader";
import StatusFilterTabs from "@/components/business-cards/StatusFilterTabs";
import JobsTableContainer from "@/components/business-cards/JobsTableContainer";
import FilterBar from "@/components/business-cards/FilterBar";
import { useBusinessCardJobsList } from "@/hooks/useBusinessCardJobsList";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

const BusinessCardJobs = () => {
  const navigate = useNavigate();
  const { 
    jobs, 
    isLoading, 
    error,
    filterView, 
    filterCounts, 
    laminationFilter, 
    selectedJobs,
    isFixingBatchedJobs,
    setFilterView, 
    setLaminationFilter, 
    fetchJobs,
    deleteJob,
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
      
      {/* Error message if there's an issue fetching data */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">There was a problem loading your jobs</p>
              <p className="text-sm mt-1">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => fetchJobs()}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}
      
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
          selectedJobs={getSelectedJobObjects(jobs)}
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
        
        {/* Jobs Table */}
        <JobsTableContainer 
          jobs={jobs}
          isLoading={isLoading}
          error={error}
          onRefresh={fetchJobs}
          selectedJobs={selectedJobs}
          onSelectJob={handleSelectJob}
          onSelectAllJobs={(isSelected) => handleSelectAllJobs(isSelected, jobs)}
          deleteJob={deleteJob}
        />
      </div>
    </div>
  );
};

export default BusinessCardJobs;
