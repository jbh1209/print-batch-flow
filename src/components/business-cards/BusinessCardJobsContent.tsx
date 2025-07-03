import { useNavigate } from "react-router-dom"; 
import StatusFilterTabs from "@/components/business-cards/StatusFilterTabs";
import JobsTableContainer from "@/components/business-cards/JobsTableContainer";
import FilterBar from "@/components/business-cards/FilterBar";
import { useBusinessCardJobsList } from "@/hooks/useBusinessCardJobsList";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const BusinessCardJobsContent = () => {
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
    fetchJobs,
    getSelectedJobObjects,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  } = useBusinessCardJobsList();

  const handleBatchComplete = () => {
    fetchJobs();
  };

  const handleJobDeleted = async (jobId: string) => {
    console.log("Handling job deletion:", jobId);
    
    try {
      // Allow deletion by all users - permissions are handled at component level
      const { error } = await supabase
        .from("business_card_jobs")
        .delete()
        .eq("id", jobId);

      if (error) throw error;

      sonnerToast.success("Job deleted successfully");
      
      // Refresh jobs list
      await fetchJobs();
    } catch (error) {
      console.error("Error deleting job:", error);
      sonnerToast.error("Failed to delete job. Please try again.");
    }
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
    <div className="space-y-4">
      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>There was a problem loading your jobs</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fetchJobs()}
              >
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="bg-card rounded-lg border shadow-sm">
        <StatusFilterTabs 
          filterView={filterView as any} 
          filterCounts={filterCounts} 
          setFilterView={setFilterView as any} 
        />
        
        <FilterBar 
          laminationFilter={laminationFilter as any}
          setLaminationFilter={setLaminationFilter as any}
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
          onJobDeleted={handleJobDeleted}
        />
      </div>
    </div>
  );
};

export default BusinessCardJobsContent;