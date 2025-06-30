
import { useNavigate } from "react-router-dom"; 
import JobsHeader from "@/components/business-cards/JobsHeader";
import StatusFilterTabs from "@/components/business-cards/StatusFilterTabs";
import JobsTableContainer from "@/components/business-cards/JobsTableContainer";
import FilterBar from "@/components/business-cards/FilterBar";
import { useBusinessCardJobsList } from "@/hooks/useBusinessCardJobsList";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    setFilterView, 
    setLaminationFilter, 
    handleSelectJob, 
    handleSelectAllJobs,
    handleJobDeleted,
    fetchJobs,
    getSelectedJobObjects,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  } = useBusinessCardJobsList();

  const handleBatchComplete = () => {
    fetchJobs();
  };

  const handleFixOrphanedJobs = async () => {
    try {
      sonnerToast.info("Fixing orphaned jobs...");
      
      const { data: orphanedJobs, error: findError } = await supabase
        .from('business_card_jobs')
        .select('id')
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) throw findError;
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        const { error: updateError } = await supabase
          .from('business_card_jobs')
          .update({ status: 'queued' })
          .in('id', orphanedJobs.map(job => job.id));
        
        if (updateError) throw updateError;
        
        sonnerToast.success(`Fixed ${orphanedJobs.length} orphaned jobs`);
        fetchJobs();
      } else {
        sonnerToast.info("No orphaned jobs found");
      }
    } catch (error) {
      console.error('Error fixing orphaned jobs:', error);
      sonnerToast.error("Failed to fix orphaned jobs");
    }
  };

  return (
    <div>
      <JobsHeader 
        title="All Business Card Jobs" 
        subtitle="View and manage all business card jobs" 
      />
      
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
        <StatusFilterTabs 
          filterView={filterView as "all" | "queued" | "batched" | "completed" | "cancelled"} 
          filterCounts={filterCounts} 
          setFilterView={setFilterView} 
        />
        
        <FilterBar 
          laminationFilter={laminationFilter === 'all' ? null : laminationFilter}
          setLaminationFilter={setLaminationFilter}
          selectedJobs={getSelectedJobObjects(jobs)}
          allAvailableJobs={jobs}
          onBatchComplete={handleBatchComplete}
          onSelectJob={handleSelectJob}
        />
        
        {filterCounts.batched > 0 && (
          <div className="border-t p-3 bg-amber-50 flex justify-between items-center">
            <div className="text-sm text-amber-800">
              <span className="font-medium">Note:</span> Some jobs may be stuck in "batched" status after a batch was deleted.
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white"
              onClick={handleFixOrphanedJobs}
            >
              Fix Orphaned Jobs
            </Button>
          </div>
        )}
        
        <JobsTableContainer 
          jobs={jobs}
          isLoading={isLoading}
          error={error}
          onRefresh={() => fetchJobs()}
          selectedJobs={selectedJobs}
          onSelectJob={handleSelectJob}
          onSelectAllJobs={(isSelected) => handleSelectAllJobs(isSelected, jobs)}
          onJobDeleted={(jobId: string) => handleJobDeleted(jobId)}
        />
      </div>
    </div>
  );
};

export default BusinessCardJobs;
