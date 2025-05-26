
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Job } from "@/components/business-cards/JobsTable";
import { useJobFilters } from "./business-cards/useJobFilters";
import { useJobSelection } from "./business-cards/useJobSelection";
import { useBatchCleanup } from "./business-cards/useBatchCleanup";
import { toast as sonnerToast } from "sonner";

export const useBusinessCardJobsList = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const {
    filterView,
    setFilterView,
    laminationFilter,
    setLaminationFilter,
    filterCounts,
    setFilterCounts,
  } = useJobFilters();

  const {
    selectedJobs,
    setSelectedJobs,
    handleSelectJob,
    handleSelectAllJobs,
    getSelectedJobObjects,
  } = useJobSelection();

  const {
    isFixingBatchedJobs,
    fixBatchedJobsWithoutBatch,
  } = useBatchCleanup();

  const fetchJobs = useCallback(async () => {
    if (!user) {
      console.log("No authenticated user found for jobs");
      setJobs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Fetching business card jobs");
      
      let query = supabase
        .from('business_card_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filterView !== 'all') {
        query = query.eq('status', filterView);
      }
      
      if (laminationFilter) {
        query = query.eq('lamination_type', laminationFilter);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }
      
      console.log("Business card jobs data received:", data?.length || 0, "records");
      
      setJobs(data || []);
      
      // Get filter counts
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status');
      
      if (countError) {
        console.warn("Error fetching counts:", countError);
        // Don't throw here, just log the warning
      } else {
        setFilterCounts({
          all: allJobs?.length || 0,
          queued: allJobs?.filter(job => job.status === 'queued').length || 0,
          batched: allJobs?.filter(job => job.status === 'batched').length || 0,
          completed: allJobs?.filter(job => job.status === 'completed').length || 0
        });
      }
      
      // Clear selections when data changes
      setSelectedJobs([]);
      
    } catch (error) {
      console.error('Error fetching jobs:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load jobs data";
      setError(errorMessage);
      
      toast({
        title: "Error fetching jobs",
        description: "There was a problem loading your jobs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, filterView, laminationFilter, toast]);

  const deleteJob = useCallback(async (jobId: string): Promise<boolean> => {
    if (!jobId) {
      console.error("No job ID provided for deletion");
      return false;
    }

    try {
      console.log("Deleting job:", jobId);
      
      const { error: deleteError } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', jobId);
      
      if (deleteError) {
        console.error("Database deletion error:", deleteError);
        throw new Error(`Database error: ${deleteError.message}`);
      }
      
      // Update local state immediately
      setJobs(prevJobs => {
        const updatedJobs = prevJobs.filter(job => job.id !== jobId);
        console.log(`Job removed from state. Jobs count: ${prevJobs.length} -> ${updatedJobs.length}`);
        return updatedJobs;
      });
      
      // Remove from selection if it was selected
      setSelectedJobs(prevSelected => prevSelected.filter(id => id !== jobId));
      
      sonnerToast.success("Job deleted successfully");
      return true;
      
    } catch (error) {
      console.error('Error deleting job:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete job";
      
      sonnerToast.error(`Delete failed: ${errorMessage}`);
      
      toast({
        title: "Error deleting job",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    }
  }, [toast]);

  // Initial fetch and when dependencies change
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);
  
  // Fix batched jobs on mount
  useEffect(() => {
    if (user) {
      fixBatchedJobsWithoutBatch().catch(error => {
        console.error("Error fixing batched jobs:", error);
        // Don't show user error for this background operation
      });
    }
  }, [user, fixBatchedJobsWithoutBatch]);

  return {
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
  };
};
