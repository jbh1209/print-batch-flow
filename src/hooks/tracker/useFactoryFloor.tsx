
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface QueueJob {
  job_id: string;
  job_table_name: string;
  wo_no: string;
  customer?: string;
  due_date?: string;
  status: string;
  priority_order: number;
  has_priority_override: boolean;
  current_stage?: string;
  is_blocked: boolean;
}

interface ActiveJob {
  id: string;
  job_id: string;
  job_table_name: string;
  department_id: string;
  stage_id?: string;
  started_at: string;
}

export const useFactoryFloor = (departmentId?: string) => {
  const { user } = useAuth();
  const [jobQueue, setJobQueue] = useState<QueueJob[]>([]);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canStartNewJob, setCanStartNewJob] = useState(false);

  // Fetch job queue for department
  const fetchJobQueue = useCallback(async () => {
    if (!departmentId) return;

    try {
      const { data, error } = await supabase
        .rpc('get_department_job_queue', { p_department_id: departmentId });
      
      if (error) throw error;
      
      // Calculate blocking logic based on department rules
      const processedJobs = (data || []).map((job: QueueJob, index: number) => ({
        ...job,
        is_blocked: false // Will implement blocking logic based on active jobs
      }));
      
      setJobQueue(processedJobs);
    } catch (err) {
      console.error('Error fetching job queue:', err);
      toast.error('Failed to load job queue');
    }
  }, [departmentId]);

  // Fetch user's active jobs
  const fetchActiveJobs = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('active_job_assignments')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      setActiveJobs(data || []);
    } catch (err) {
      console.error('Error fetching active jobs:', err);
    }
  }, [user?.id]);

  // Check if user can start a new job
  const checkCanStartNewJob = useCallback(async () => {
    if (!user?.id || !departmentId) {
      setCanStartNewJob(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('can_user_start_new_job', { 
          p_user_id: user.id, 
          p_department_id: departmentId 
        });
      
      if (error) throw error;
      setCanStartNewJob(data || false);
    } catch (err) {
      console.error('Error checking if user can start new job:', err);
      setCanStartNewJob(false);
    }
  }, [user?.id, departmentId]);

  // Start working on a job
  const startJob = async (jobId: string, jobTableName: string, stageId?: string) => {
    if (!user?.id || !departmentId) return false;

    try {
      const { error } = await supabase
        .from('active_job_assignments')
        .insert({
          user_id: user.id,
          job_id: jobId,
          job_table_name: jobTableName,
          department_id: departmentId,
          stage_id: stageId
        });
      
      if (error) throw error;
      
      toast.success('Job started successfully');
      await Promise.all([fetchActiveJobs(), fetchJobQueue(), checkCanStartNewJob()]);
      return true;
    } catch (err) {
      console.error('Error starting job:', err);
      toast.error('Failed to start job');
      return false;
    }
  };

  // Complete/finish a job
  const completeJob = async (activeJobId: string) => {
    try {
      const { error } = await supabase
        .from('active_job_assignments')
        .delete()
        .eq('id', activeJobId)
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      toast.success('Job completed successfully');
      await Promise.all([fetchActiveJobs(), fetchJobQueue(), checkCanStartNewJob()]);
      return true;
    } catch (err) {
      console.error('Error completing job:', err);
      toast.error('Failed to complete job');
      return false;
    }
  };

  // Process barcode scan
  const processBarcodeAction = async (barcodeData: string, action: string) => {
    if (!user?.id) return false;

    try {
      // Log the scan attempt
      await supabase
        .from('barcode_scan_log')
        .insert({
          user_id: user.id,
          barcode_data: barcodeData,
          action_taken: action,
          scan_result: 'processing'
        });

      // Parse barcode and find job
      // Implementation will depend on barcode format
      toast.info('Barcode scan processed');
      return true;
    } catch (err) {
      console.error('Error processing barcode:', err);
      toast.error('Failed to process barcode scan');
      return false;
    }
  };

  // Update job priority
  const updateJobPriority = async (jobId: string, jobTableName: string, newPriority: number, reason?: string) => {
    if (!user?.id || !departmentId) return false;

    try {
      const { error } = await supabase
        .from('job_priority_overrides')
        .upsert({
          job_id: jobId,
          job_table_name: jobTableName,
          department_id: departmentId,
          priority_order: newPriority,
          set_by: user.id,
          reason: reason
        });
      
      if (error) throw error;
      
      toast.success('Job priority updated');
      await fetchJobQueue();
      return true;
    } catch (err) {
      console.error('Error updating job priority:', err);
      toast.error('Failed to update job priority');
      return false;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchJobQueue(),
        fetchActiveJobs(),
        checkCanStartNewJob()
      ]);
      setIsLoading(false);
    };

    if (user && departmentId) {
      loadData();
    }
  }, [user, departmentId, fetchJobQueue, fetchActiveJobs, checkCanStartNewJob]);

  return {
    jobQueue,
    activeJobs,
    canStartNewJob,
    isLoading,
    startJob,
    completeJob,
    processBarcodeAction,
    updateJobPriority,
    refreshQueue: fetchJobQueue,
    refreshActiveJobs: fetchActiveJobs
  };
};
