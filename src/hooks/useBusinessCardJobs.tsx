
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Job } from "@/components/business-cards/JobsTable";

interface UseBusinessCardJobsReturn {
  jobs: Job[];
  isLoading: boolean;
  error: string | null;
  selectedJobs: string[];
  filterView: "all" | "queued" | "batched" | "completed";
  laminationFilter: string | null;
  filterCounts: {
    all: number;
    queued: number;
    batched: number;
    completed: number;
  };
  // Actions
  setFilterView: (view: "all" | "queued" | "batched" | "completed") => void;
  setLaminationFilter: (filter: string | null) => void;
  handleSelectJob: (jobId: string, isSelected: boolean) => void;
  handleSelectAllJobs: (isSelected: boolean) => void;
  handleDeleteJob: (jobId: string) => Promise<void>;
  refreshJobs: () => void;
  getSelectedJobObjects: () => Job[];
}

export const useBusinessCardJobs = (): UseBusinessCardJobsReturn => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [filterView, setFilterView] = useState<"all" | "queued" | "batched" | "completed">("all");
  const [laminationFilter, setLaminationFilter] = useState<string | null>(null);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInProgressRef = useRef(false);

  const fetchJobs = useCallback(async () => {
    if (!user || isRequestInProgressRef.current) {
      console.log("Skipping fetch - no user or request in progress");
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    isRequestInProgressRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching business card jobs with filters:", { filterView, laminationFilter });

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

      if (abortControllerRef.current?.signal.aborted) {
        console.log("Request was aborted");
        return;
      }

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("Jobs fetched successfully:", data?.length || 0);
      setJobs(data || []);

      // Get filter counts
      const { data: allJobs } = await supabase
        .from('business_card_jobs')
        .select('status');

      if (allJobs && !abortControllerRef.current?.signal.aborted) {
        setFilterCounts({
          all: allJobs.length,
          queued: allJobs.filter(job => job.status === 'queued').length,
          batched: allJobs.filter(job => job.status === 'batched').length,
          completed: allJobs.filter(job => job.status === 'completed').length
        });
      }

      // Clear selections when data changes
      setSelectedJobs([]);

    } catch (error) {
      if (!abortControllerRef.current?.signal.aborted) {
        console.error('Error fetching jobs:', error);
        const errorMessage = error instanceof Error ? error.message : "Failed to load jobs";
        setError(errorMessage);
      }
    } finally {
      isRequestInProgressRef.current = false;
      setIsLoading(false);
    }
  }, [user, filterView, laminationFilter]);

  // Initial fetch and filter changes
  useEffect(() => {
    fetchJobs();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isRequestInProgressRef.current = false;
    };
  }, [fetchJobs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSelectJob = useCallback((jobId: string, isSelected: boolean) => {
    setSelectedJobs(prev => 
      isSelected 
        ? [...prev, jobId]
        : prev.filter(id => id !== jobId)
    );
  }, []);

  const handleSelectAllJobs = useCallback((isSelected: boolean) => {
    setSelectedJobs(isSelected ? jobs.map(job => job.id) : []);
  }, [jobs]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    console.log("Deleting job:", jobId);

    try {
      // Optimistic update - remove job immediately
      setJobs(prev => prev.filter(job => job.id !== jobId));
      setSelectedJobs(prev => prev.filter(id => id !== jobId));

      const { error } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', jobId);

      if (error) {
        console.error("Delete error:", error);
        // Revert optimistic update on error
        fetchJobs();
        throw new Error(`Failed to delete job: ${error.message}`);
      }

      console.log("Job deleted successfully");
      
      // Update filter counts
      setFilterCounts(prev => ({
        ...prev,
        all: Math.max(0, prev.all - 1),
        queued: Math.max(0, prev.queued - 1), // Assume it was queued
      }));

    } catch (error) {
      console.error("Job deletion failed:", error);
      throw error;
    }
  }, [fetchJobs]);

  const refreshJobs = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  const getSelectedJobObjects = useCallback(() => {
    return jobs.filter(job => selectedJobs.includes(job.id));
  }, [jobs, selectedJobs]);

  return {
    jobs,
    isLoading,
    error,
    selectedJobs,
    filterView,
    laminationFilter,
    filterCounts,
    setFilterView,
    setLaminationFilter,
    handleSelectJob,
    handleSelectAllJobs,
    handleDeleteJob,
    refreshJobs,
    getSelectedJobObjects
  };
};
