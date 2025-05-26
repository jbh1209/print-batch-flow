
import { useState, useEffect, useCallback, useRef } from "react";
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInProgressRef = useRef(false);

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

  const fetchJobs = useCallback(async (showToastOnError = true) => {
    if (!user) {
      console.log("No authenticated user found for jobs");
      setJobs([]);
      setIsLoading(false);
      return;
    }

    // Prevent multiple simultaneous requests
    if (isRequestInProgressRef.current) {
      console.log("Request already in progress, skipping");
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    isRequestInProgressRef.current = true;
    
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
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        console.log("Request was aborted");
        return;
      }
      
      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }
      
      console.log("Business card jobs data received:", data?.length || 0, "records");
      
      setJobs(data || []);
      
      // Get filter counts in same request cycle
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status');
      
      if (countError) {
        console.warn("Error fetching counts:", countError);
      } else {
        setFilterCounts({
          all: allJobs?.length || 0,
          queued: allJobs?.filter(job => job.status === 'queued').length || 0,
          batched: allJobs?.filter(job => job.status === 'batched').length || 0,
          completed: allJobs?.filter(job => job.status === 'completed').length || 0
        });
      }
      
      setSelectedJobs([]);
      
    } catch (error) {
      // Don't show toast for aborted requests
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      console.error('Error fetching jobs:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load jobs data";
      setError(errorMessage);
      
      if (showToastOnError) {
        toast({
          title: "Error fetching jobs",
          description: "There was a problem loading your jobs.",
          variant: "destructive",
        });
      }
    } finally {
      isRequestInProgressRef.current = false;
      setIsLoading(false);
    }
  }, [user, filterView, laminationFilter, setFilterCounts, setSelectedJobs]);

  // Single effect for initial load and filter changes
  useEffect(() => {
    fetchJobs();
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isRequestInProgressRef.current = false;
    };
  }, [user, filterView, laminationFilter]);

  // Separate effect for batch cleanup - runs only once when user changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (user) {
      // Add small delay to avoid race conditions with main fetch
      timeoutId = setTimeout(() => {
        fixBatchedJobsWithoutBatch().catch(error => {
          console.error("Error fixing batched jobs:", error);
        });
      }, 500);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, fixBatchedJobsWithoutBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const refreshJobs = useCallback(() => {
    fetchJobs(false); // Don't show toast on manual refresh
  }, [fetchJobs]);

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
    fetchJobs: refreshJobs,
    fixBatchedJobsWithoutBatch,
    handleSelectJob,
    handleSelectAllJobs,
    getSelectedJobObjects
  };
};
