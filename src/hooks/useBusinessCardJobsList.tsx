import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useJobFilters } from "./business-cards/useJobFilters";
import { useJobSelection } from "./business-cards/useJobSelection";
import { useBatchCleanup } from "./business-cards/useBatchCleanup";

// Updated Job interface with lamination_type
export interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  due_date: string;
  uploaded_at: string;
  status: string;
  pdf_url: string;
  double_sided: boolean;
  job_number: string;
  updated_at: string;
  user_id: string;
  lamination_type: 'gloss' | 'matt' | 'soft_touch' | 'none';
}

export const useBusinessCardJobsList = () => {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
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
    // Wait for auth to load before fetching
    if (authLoading) {
      console.log("Auth still loading, waiting...");
      return;
    }

    if (isRequestInProgressRef.current) {
      console.log("Request already in progress, skipping");
      return;
    }

    try {
      isRequestInProgressRef.current = true;
      setIsLoading(true);
      setError(null);

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      console.log("Fetching business card jobs for all users");

      // Remove user filtering to show all jobs
      const { data, error: fetchError } = await supabase
        .from("business_card_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .abortSignal(abortControllerRef.current.signal);

      if (fetchError) {
        if (fetchError.name === 'AbortError') {
          console.log("Request was aborted");
          return;
        }
        throw fetchError;
      }

      console.log("Business card jobs fetched:", data?.length || 0, "jobs");
      
      // Transform data to match Job interface with lamination_type
      const jobsWithDefaults: Job[] = (data || []).map(job => ({
        id: job.id,
        name: job.name,
        file_name: job.file_name,
        quantity: job.quantity,
        due_date: job.due_date,
        uploaded_at: job.created_at,
        status: job.status,
        pdf_url: job.pdf_url,
        double_sided: job.double_sided || false,
        job_number: job.job_number,
        updated_at: job.updated_at,
        user_id: job.user_id,
        lamination_type: (job as any).lamination_type || 'none' as const // Ensure lamination_type is included with safe fallback
      }));

      setJobs(jobsWithDefaults);
      
      // Update filter counts
      const counts = {
        all: jobsWithDefaults.length,
        queued: jobsWithDefaults.filter(job => job.status === 'queued').length,
        batched: jobsWithDefaults.filter(job => job.status === 'batched').length,
        completed: jobsWithDefaults.filter(job => job.status === 'completed').length,
        cancelled: jobsWithDefaults.filter(job => job.status === 'cancelled').length,
      };
      setFilterCounts(counts);

    } catch (err) {
      console.error("Error fetching business card jobs:", err);
      if (err instanceof Error && err.name !== 'AbortError') {
        setError("Failed to load jobs");
        if (showToastOnError) {
          toast({
            title: "Error loading jobs",
            description: "Failed to load business card jobs. Please try again.",
            variant: "destructive",
          });
        }
      }
    } finally {
      setIsLoading(false);
      isRequestInProgressRef.current = false;
    }
  }, [authLoading, toast, setFilterCounts]);

  // Initial fetch when auth is ready
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleJobDeleted = async (jobId: string) => {
    console.log("Handling job deletion:", jobId);
    
    try {
      // Remove user_id filter to allow any user to delete any job
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

  const filteredJobs = jobs.filter(job => {
    const statusMatch = filterView === 'all' || job.status === filterView;
    const laminationMatch = laminationFilter === 'all' || laminationFilter === null || true;
    return statusMatch && laminationMatch;
  });

  return {
    jobs: filteredJobs,
    allJobs: jobs,
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
    getSelectedJobObjects,
    fetchJobs,
    handleJobDeleted,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs,
  };
};
