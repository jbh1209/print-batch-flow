import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getCurrentDate } from '@/utils/businessDays';

interface ProductionCalendarJob {
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  stage_name: string;
  stage_color: string;
  scheduled_date: string;
  queue_position: number;
  estimated_duration_minutes: number;
  is_expedited: boolean;
  priority_score: number;
  shift_number: number;
  current_stage_status: string;
  user_can_work: boolean;
  production_stage_id: string;
  specification?: string;
  qty?: number;
}

interface JobsByDate {
  [dateKey: string]: ProductionCalendarJob[];
}

export const useProductionCalendarFixed = (selectedStageId?: string | null) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionCalendarJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs using the same RPC function as useAccessibleJobs to get current working stages only
  const fetchScheduledJobs = async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log("🗓️ Fetching jobs from get_user_accessible_jobs RPC (same as list view)...");

      // Use the same RPC function as useAccessibleJobs to get current working stages
      const { data: accessibleJobs, error: jobsError } = await supabase
        .rpc('get_user_accessible_jobs', {
          p_user_id: user.id,
          p_permission_type: 'job_access',
          p_status_filter: null
        });

      if (jobsError) {
        console.error("❌ Error fetching accessible jobs:", jobsError);
        throw new Error(`Failed to fetch accessible jobs: ${jobsError.message}`);
      }

      console.log("✅ Accessible jobs fetched:", accessibleJobs?.length || 0);

      if (!accessibleJobs || accessibleJobs.length === 0) {
        setJobs([]);
        return;
      }

      // Apply stage filter if provided
      let filteredJobs = accessibleJobs;
      if (selectedStageId && selectedStageId !== 'batch-processing') {
        filteredJobs = accessibleJobs.filter(job => job.current_stage_id === selectedStageId);
      }

      console.log("✅ Jobs after stage filter:", filteredJobs?.length || 0);

      // Transform accessible jobs format to calendar format
      const transformedJobs: ProductionCalendarJob[] = filteredJobs
        .map(job => {
          if (!job.current_stage_id || !job.current_stage_name) {
            console.warn("⚠️ Job missing current stage data:", job.job_id);
            return null;
          }

          return {
            job_id: job.job_id,
            wo_no: job.wo_no,
            customer: job.customer,
            status: job.current_stage_status,
            stage_name: job.current_stage_name,
            stage_color: job.current_stage_color || '#6B7280',
            scheduled_date: job.due_date || format(new Date(), 'yyyy-MM-dd'),
            queue_position: 1, // RPC doesn't return queue position, default to 1
            estimated_duration_minutes: 120, // RPC doesn't return duration, default to 2 hours
            is_expedited: false, // Default to false, expedited info not available in RPC
            priority_score: 100, // Default priority
            shift_number: 1,
            current_stage_status: job.current_stage_status,
            user_can_work: true,
            production_stage_id: job.current_stage_id,
            specification: undefined, // Not available in RPC response
            qty: undefined // Not available in RPC response
          };
        })
        .filter(Boolean) as ProductionCalendarJob[];

      console.log("✅ Jobs transformed:", transformedJobs.length);
      setJobs(transformedJobs);

    } catch (err) {
      console.error('❌ Error in fetchScheduledJobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      setJobs([]);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Group jobs by scheduled date
  const jobsByDate = useMemo(() => {
    const grouped: JobsByDate = {};
    
    console.log("📊 Grouping jobs by date:", jobs.length);
    
    jobs.forEach(job => {
      const dateKey = job.scheduled_date; // Already in YYYY-MM-DD format
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(job);
    });

    // Sort jobs within each date by priority and queue position
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        // Expedited jobs first
        if (a.is_expedited !== b.is_expedited) {
          return a.is_expedited ? -1 : 1;
        }
        // Then by queue position
        return a.queue_position - b.queue_position;
      });
    });

    console.log("📊 Jobs grouped by date:", Object.keys(grouped).map(date => 
      `${date}: ${grouped[date].length} jobs`
    ).join(', '));

    return grouped;
  }, [jobs]);

  // Start a job (update stage instance status)
  const startJob = async (jobId: string, stageId: string): Promise<boolean> => {
    try {
      console.log("🚀 Starting job:", jobId, "stage:", stageId);

      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id 
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId);

      if (error) {
        console.error("❌ Error starting job:", error);
        toast.error("Failed to start job");
        return false;
      }

      // Update local state optimistically
      setJobs(prev => prev.map(job => 
        job.job_id === jobId 
          ? { ...job, current_stage_status: 'active' }
          : job
      ));

      toast.success("Job started successfully");
      return true;
    } catch (error) {
      console.error("❌ Error in startJob:", error);
      toast.error("Failed to start job");
      return false;
    }
  };

  // Complete a job (update stage instance status)
  const completeJob = async (jobId: string, stageId: string): Promise<boolean> => {
    try {
      console.log("✅ Completing job:", jobId, "stage:", stageId);

      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id 
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId);

      if (error) {
        console.error("❌ Error completing job:", error);
        toast.error("Failed to complete job");
        return false;
      }

      // Remove from local state or update status
      setJobs(prev => prev.filter(job => job.job_id !== jobId));

      toast.success("Job completed successfully");
      // Refresh to get updated data
      setTimeout(fetchScheduledJobs, 500);
      return true;
    } catch (error) {
      console.error("❌ Error in completeJob:", error);
      toast.error("Failed to complete job");
      return false;
    }
  };

  // Get jobs for a specific date
  const getJobsForDate = (dateString: string): ProductionCalendarJob[] => {
    const dateKey = format(new Date(dateString), 'yyyy-MM-dd');
    const jobsForDate = jobsByDate[dateKey] || [];
    console.log(`📅 Getting jobs for ${dateKey}:`, jobsForDate.length);
    return jobsForDate;
  };

  useEffect(() => {
    fetchScheduledJobs();
  }, [user?.id, selectedStageId]);

  return {
    jobs,
    jobsByDate,
    isLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchScheduledJobs,
    getJobsForDate
  };
};