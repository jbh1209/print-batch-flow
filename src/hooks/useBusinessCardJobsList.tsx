
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
  const [error, setError] = useState<string | null>(null);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
  });
  const [laminationFilter, setLaminationFilter] = useState<LaminationType | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [isFixingBatchedJobs, setIsFixingBatchedJobs] = useState(false);

  // Fetch jobs function that can be called to refresh the data
  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!user) {
        console.log("No authenticated user found for jobs");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching jobs for user:", user.id);
      
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
        console.error("Supabase error fetching jobs:", error);
        throw error;
      }
      
      console.log("Jobs data received:", data?.length || 0, "jobs");
      
      setJobs(data || []);
      
      // Count jobs for each status
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status')
        .eq('user_id', user.id);
      
      if (countError) {
        console.error("Error counting jobs by status:", countError);
        throw countError;
      }
      
      const counts = {
        all: allJobs?.length || 0,
        queued: allJobs?.filter(job => job.status === 'queued').length || 0,
        batched: allJobs?.filter(job => job.status === 'batched').length || 0,
        completed: allJobs?.filter(job => job.status === 'completed').length || 0
      };
      
      console.log("Job counts by status:", counts);
      
      setFilterCounts(counts);
      
      // Clear selected jobs when filters change
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

  // New function to fix jobs that are marked as batched but have no batch_id
  const fixBatchedJobsWithoutBatch = async () => {
    if (!user) {
      console.log("No authenticated user found for fix operation");
      return;
    }
    
    setIsFixingBatchedJobs(true);
    try {
      console.log("Finding orphaned batched jobs");
      
      // Find all jobs that are marked as batched but have no batch_id
      const { data: orphanedJobs, error: findError } = await supabase
        .from('business_card_jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'batched')
        .is('batch_id', null);
      
      if (findError) {
        console.error("Error finding orphaned jobs:", findError);
        throw findError;
      }
      
      console.log(`Found ${orphanedJobs?.length || 0} orphaned jobs`);
      
      if (orphanedJobs && orphanedJobs.length > 0) {
        // Reset these jobs to queued status
        const { error: updateError } = await supabase
          .from('business_card_jobs')
          .update({ status: 'queued' })
          .in('id', orphanedJobs.map(job => job.id));
        
        if (updateError) {
          console.error("Error fixing orphaned jobs:", updateError);
          throw updateError;
        }
        
        console.log(`Reset ${orphanedJobs.length} jobs to queued status`);
        
        toast({
          title: "Jobs fixed",
          description: `Reset ${orphanedJobs.length} orphaned jobs back to queued status`,
        });
        
        // Refresh the job list
        await fetchJobs();
      }
    } catch (error) {
      console.error('Error fixing batched jobs:', error);
      toast({
        title: "Error fixing jobs",
        description: "Failed to reset jobs with missing batch references.",
        variant: "destructive",
      });
    } finally {
      setIsFixingBatchedJobs(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user, filterView, laminationFilter]);
  
  // Run the fix operation once when component mounts
  useEffect(() => {
    if (user) {
      fixBatchedJobsWithoutBatch();
    }
  }, [user]);
  
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
