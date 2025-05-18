
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Job, LaminationType } from "@/components/business-cards/JobsTable";
import { useJobOperations } from "./business-cards/useJobOperations";

export const useBusinessCardJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<"all" | "queued" | "batched" | "completed">("all");
  const [laminationFilter, setLaminationFilter] = useState<string>("");
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
  });
  
  const { deleteJob } = useJobOperations(user?.id);

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!user) {
        console.log("No authenticated user found for jobs");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching all business card jobs");
      
      let query = supabase
        .from('business_card_jobs')
        .select('*');
      
      if (filterView !== 'all') {
        query = query.eq('status', filterView);
      }
      
      // Convert laminationFilter to LaminationType or handle as string
      if (laminationFilter) {
        const typedLaminationType = laminationFilter as LaminationType;
        query = query.eq('lamination_type', typedLaminationType);
      }
      
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      console.log("Business card jobs data received:", data?.length || 0, "records");
      
      setJobs(data || []);
      
      // Second query to get all job counts for filters
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status');
      
      if (countError) throw countError;
      
      setFilterCounts({
        all: allJobs?.length || 0,
        queued: allJobs?.filter(job => job.status === 'queued').length || 0,
        batched: allJobs?.filter(job => job.status === 'batched').length || 0,
        completed: allJobs?.filter(job => job.status === 'completed').length || 0
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError("Failed to load jobs data");
      toast.error("Error fetching jobs", {
        description: "There was a problem loading your jobs."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteJob = async (jobId: string): Promise<boolean> => {
    try {
      // Check if the user is trying to delete someone else's job
      const jobToDelete = jobs.find(job => job.id === jobId);
      if (jobToDelete && jobToDelete.user_id !== user?.id) {
        toast.error("You can only delete your own jobs");
        return false;
      }
      
      const success = await deleteJob(jobId);
      
      if (success) {
        // Remove the job from state
        setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
        toast.success("Job deleted successfully");
      }
      
      return success;
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error("Error deleting job", {
        description: "There was a problem deleting the job."
      });
      return false;
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user, filterView, laminationFilter]);

  return {
    jobs,
    isLoading,
    error,
    filterView,
    filterCounts,
    laminationFilter,
    setFilterView,
    setLaminationFilter,
    fetchJobs,
    deleteJob: handleDeleteJob
  };
};
