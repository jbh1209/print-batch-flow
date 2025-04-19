
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Job } from "@/components/business-cards/JobsTable";
import { useJobFilters } from "./business-cards/useJobFilters";
import { useJobSelection } from "./business-cards/useJobSelection";
import { useBatchCleanup } from "./business-cards/useBatchCleanup";

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
      
      let query = supabase
        .from('business_card_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (filterView !== 'all') {
        query = query.eq('status', filterView);
      }
      
      if (laminationFilter) {
        query = query.eq('lamination_type', laminationFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setJobs(data || []);
      
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status')
        .eq('user_id', user.id);
      
      if (countError) throw countError;
      
      setFilterCounts({
        all: allJobs?.length || 0,
        queued: allJobs?.filter(job => job.status === 'queued').length || 0,
        batched: allJobs?.filter(job => job.status === 'batched').length || 0,
        completed: allJobs?.filter(job => job.status === 'completed').length || 0
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
    fixBatchedJobsWithoutBatch,
    handleSelectJob,
    handleSelectAllJobs,
    getSelectedJobObjects
  };
};
