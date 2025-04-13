
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Job, JobStatus, LaminationType } from "@/components/business-cards/JobsTable";

export const useBusinessCardJobsList = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [filterView, setFilterView] = useState<JobStatus | "all">("all");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
  });
  const [laminationFilter, setLaminationFilter] = useState<LaminationType | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  // Fetch jobs function that can be called to refresh the data
  const fetchJobs = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('business_card_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      // Apply status filter
      if (filterView !== 'all') {
        query = query.eq('status', filterView);
      }
      
      // Apply lamination filter
      if (laminationFilter) {
        query = query.eq('lamination_type', laminationFilter);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setJobs(data || []);
      
      // Count jobs for each status
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status')
        .eq('user_id', user.id);
      
      if (countError) {
        throw countError;
      }
      
      const counts = {
        all: allJobs?.length || 0,
        queued: allJobs?.filter(job => job.status === 'queued').length || 0,
        batched: allJobs?.filter(job => job.status === 'batched').length || 0,
        completed: allJobs?.filter(job => job.status === 'completed').length || 0
      };
      
      setFilterCounts(counts);
      
      // Clear selected jobs when filters change
      setSelectedJobs([]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
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
  }, [user, filterView, laminationFilter, toast]);
  
  // Handle job selection
  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs([...selectedJobs, jobId]);
    } else {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    }
  };
  
  // Handle select all jobs
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      // Only select jobs that are in "queued" status
      const selectableJobIds = jobs
        .filter(job => job.status === "queued")
        .map(job => job.id);
      setSelectedJobs(selectableJobIds);
    } else {
      setSelectedJobs([]);
    }
  };
  
  // Get selected job objects
  const getSelectedJobObjects = () => {
    return jobs.filter(job => selectedJobs.includes(job.id));
  };

  return {
    jobs,
    isLoading,
    filterView,
    filterCounts,
    laminationFilter,
    selectedJobs,
    setFilterView,
    setLaminationFilter,
    fetchJobs,
    handleSelectJob,
    handleSelectAllJobs,
    getSelectedJobObjects
  };
};
