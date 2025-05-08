
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Job } from "@/components/business-cards/JobsTable";
import { useJobFilters } from "./business-cards/useJobFilters";
import { useJobSelection } from "./business-cards/useJobSelection";
import { useBatchCleanup } from "./business-cards/useBatchCleanup";
import { castToUUID, toJobArray, prepareUpdateParams } from "@/utils/database/dbHelpers";

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

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!user) {
        console.log("No authenticated user found for jobs");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching business card jobs for user:", user.id);
      
      let query = supabase
        .from('business_card_jobs')
        .select('*')
        .eq('user_id', castToUUID(user.id))
        .order('created_at', { ascending: false });
      
      if (filterView !== 'all') {
        query = query.eq('status', filterView as any);
      }
      
      if (laminationFilter) {
        query = query.eq('lamination_type', laminationFilter as any);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      console.log("Business card jobs data received:", data?.length || 0, "records");
      
      // Convert to properly typed Job array using our utility function
      const typedJobs = toJobArray<Job>(data);
      setJobs(typedJobs);
      
      // Second query to get all job counts for filters
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status')
        .eq('user_id', castToUUID(user.id));
      
      if (countError) throw countError;
      
      // Process job counts safely
      const allJobsArray = allJobs || [];
      
      setFilterCounts({
        all: allJobsArray.length || 0,
        queued: allJobsArray.filter(job => job?.status === 'queued').length || 0,
        batched: allJobsArray.filter(job => job?.status === 'batched').length || 0,
        completed: allJobsArray.filter(job => job?.status === 'completed').length || 0
      });
      
      setSelectedJobs([]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError("Failed to load jobs data");
      toast({
        title: "Error fetching jobs",
        description: "There was a problem loading your jobs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteJob = async (jobId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', castToUUID(jobId));
      
      if (deleteError) throw deleteError;
      
      // Remove the job from state
      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      
      // If job was selected, remove it from selection
      setSelectedJobs(prevSelected => prevSelected.filter(id => id !== jobId));
      
      toast({
        title: "Job deleted",
        description: "The job was successfully deleted.",
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error deleting job",
        description: "There was a problem deleting the job.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user, filterView, laminationFilter]);
  
  useEffect(() => {
    if (user) {
      fixBatchedJobsWithoutBatch();
    }
  }, [user]);

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
