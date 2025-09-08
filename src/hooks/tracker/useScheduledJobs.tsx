import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ScheduledJobStage {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_order: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  queue_position?: number;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  scheduled_minutes?: number;
  estimated_duration_minutes?: number;
  schedule_status?: string;
  // Job details
  wo_no: string;
  customer: string;
  due_date?: string;
  qty: number;
  category_name: string;
  category_color: string;
  // Readiness indicators
  is_ready_now: boolean;
  is_scheduled_later: boolean;
  is_waiting_for_dependencies: boolean;
  // Dependencies
  dependency_group?: string;
  part_assignment?: string;
}

export type JobReadinessStatus = 'ready_now' | 'scheduled_later' | 'waiting_dependencies' | 'blocked';

interface UseScheduledJobsOptions {
  production_stage_id?: string;
  department_filter?: string;
  include_all_stages?: boolean;
}

export const useScheduledJobs = (options: UseScheduledJobsOptions = {}) => {
  const { user } = useAuth();
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJobStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchScheduledJobs = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔄 Fetching scheduled jobs with options:', options);

      // Query job_stage_instances with scheduling data and job details
      let query = supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          job_table_name,
          production_stage_id,
          stage_order,
          status,
          queue_position,
          scheduled_start_at,
          scheduled_end_at,
          scheduled_minutes,
          estimated_duration_minutes,
          schedule_status,
          dependency_group,
          part_assignment,
          production_stages!inner (
            name,
            color
          )
        `)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['pending', 'active']);

      // Filter by production stage if specified
      if (options.production_stage_id) {
        query = query.eq('production_stage_id', options.production_stage_id);
      }

      // Add ordering: scheduled jobs first (by start time), then by queue position, then by stage order
      query = query.order('scheduled_start_at', { ascending: true, nullsFirst: false })
                   .order('queue_position', { ascending: true, nullsFirst: false })
                   .order('stage_order', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Get job details separately to avoid complex join issues
      const jobIds = data?.map(stage => stage.job_id) || [];
      let jobDetailsMap = new Map();
      
      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from('production_jobs')
          .select(`
            id,
            wo_no,
            customer,
            due_date,
            qty,
            status,
            category_id,
            categories (
              name,
              color
            )
          `)
          .in('id', jobIds);

        jobsData?.forEach(job => {
          jobDetailsMap.set(job.id, job);
        });
      }

      // Process and enhance job data with readiness indicators
      const processedJobs: ScheduledJobStage[] = (data || []).map((stage: any) => {
        const jobData = jobDetailsMap.get(stage.job_id);
        const stageData = stage.production_stages;
        const categoryData = jobData?.categories;

        // Determine readiness status
        const now = new Date();
        const scheduledStart = stage.scheduled_start_at ? new Date(stage.scheduled_start_at) : null;
        
        let is_ready_now = false;
        let is_scheduled_later = false;
        let is_waiting_for_dependencies = false;

        if (stage.status === 'active') {
          is_ready_now = true;
        } else if (stage.status === 'pending') {
          if (scheduledStart) {
            // Job is scheduled
            if (scheduledStart <= now) {
              is_ready_now = true; // Scheduled time has passed
            } else {
              is_scheduled_later = true; // Scheduled for future
            }
          } else {
            // Not yet scheduled - check dependencies
            // This is a simplified check - in reality we'd need to check previous stages
            is_waiting_for_dependencies = true;
          }
        }

        return {
          id: stage.id,
          job_id: stage.job_id,
          job_table_name: stage.job_table_name,
          production_stage_id: stage.production_stage_id,
          stage_name: stageData?.name || 'Unknown Stage',
          stage_color: stageData?.color || '#6B7280',
          stage_order: stage.stage_order,
          status: stage.status,
          queue_position: stage.queue_position,
          scheduled_start_at: stage.scheduled_start_at,
          scheduled_end_at: stage.scheduled_end_at,
          scheduled_minutes: stage.scheduled_minutes,
          estimated_duration_minutes: stage.estimated_duration_minutes,
          schedule_status: stage.schedule_status,
          dependency_group: stage.dependency_group,
          part_assignment: stage.part_assignment,
          // Job details
          wo_no: jobData?.wo_no || 'Unknown',
          customer: jobData?.customer || 'Unknown Customer',
          due_date: jobData?.due_date,
          qty: jobData?.qty || 0,
          category_name: categoryData?.name || 'No Category',
          category_color: categoryData?.color || '#6B7280',
          // Readiness indicators
          is_ready_now,
          is_scheduled_later,
          is_waiting_for_dependencies
        };
      });

      setScheduledJobs(processedJobs);
      setLastUpdate(new Date());

      console.log(`✅ Fetched ${processedJobs.length} scheduled job stages`);

    } catch (err) {
      console.error('❌ Error fetching scheduled jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scheduled jobs');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, options]);

  // Initial fetch
  useEffect(() => {
    fetchScheduledJobs();
  }, [fetchScheduledJobs]);

  // Real-time subscription for schedule updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('📡 Setting up real-time subscription for scheduled jobs');

    const channel = supabase
      .channel('scheduled-jobs-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
          filter: `job_table_name=eq.production_jobs`
        },
        (payload) => {
          console.log('🔄 Real-time update received for job stages:', payload);
          fetchScheduledJobs();
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Unsubscribing from scheduled jobs updates');
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchScheduledJobs]);

  // Group jobs by readiness status
  const jobsByReadiness = useMemo(() => {
    const ready = scheduledJobs.filter(job => job.is_ready_now);
    const scheduledLater = scheduledJobs.filter(job => job.is_scheduled_later);
    const waitingDependencies = scheduledJobs.filter(job => job.is_waiting_for_dependencies);
    
    return {
      ready_now: ready,
      scheduled_later: scheduledLater,
      waiting_dependencies: waitingDependencies
    };
  }, [scheduledJobs]);

  // Job actions with scheduling awareness
  const startScheduledJob = useCallback(async (stageId: string): Promise<boolean> => {
    try {
      const job = scheduledJobs.find(j => j.id === stageId);
      if (!job) {
        toast.error('Job not found');
        return false;
      }

      if (!job.is_ready_now) {
        toast.error('Job is not ready to start yet');
        return false;
      }

      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id
        })
        .eq('id', stageId);

      if (error) throw error;

      toast.success(`Started job ${job.wo_no} - ${job.stage_name}`);
      await fetchScheduledJobs();
      return true;
    } catch (error) {
      console.error('❌ Error starting scheduled job:', error);
      toast.error('Failed to start job');
      return false;
    }
  }, [scheduledJobs, user?.id, fetchScheduledJobs]);

  const completeScheduledJob = useCallback(async (stageId: string, notes?: string): Promise<boolean> => {
    try {
      const job = scheduledJobs.find(j => j.id === stageId);
      if (!job) {
        toast.error('Job not found');
        return false;
      }

      if (job.status !== 'active') {
        toast.error('Job must be active to complete');
        return false;
      }

      // Use appropriate completion function based on job type
      const { data: parallelCheck } = await supabase
        .from('job_stage_instances')
        .select('part_assignment')
        .eq('job_id', job.job_id)
        .eq('job_table_name', 'production_jobs')
        .neq('part_assignment', 'both')
        .limit(1);
      
      const hasParallelComponents = parallelCheck && parallelCheck.length > 0;
      
      let error;
      if (hasParallelComponents) {
        const result = await supabase.rpc('advance_parallel_job_stage' as any, {
          p_job_id: job.job_id,
          p_job_table_name: job.job_table_name,
          p_current_stage_id: job.production_stage_id,
          p_completed_by: user?.id,
          p_notes: notes
        });
        error = result.error;
      } else {
        const result = await supabase.rpc('advance_job_stage', {
          p_job_id: job.job_id,
          p_job_table_name: job.job_table_name,
          p_current_stage_id: job.production_stage_id,
          p_completed_by: user?.id,
          p_notes: notes
        });
        error = result.error;
      }

      if (error) throw error;

      toast.success(`Completed job ${job.wo_no} - ${job.stage_name}`);
      await fetchScheduledJobs();
      return true;
    } catch (error) {
      console.error('❌ Error completing scheduled job:', error);
      toast.error('Failed to complete job');
      return false;
    }
  }, [scheduledJobs, user?.id, fetchScheduledJobs]);

  return {
    scheduledJobs,
    jobsByReadiness,
    isLoading,
    error,
    lastUpdate,
    // Actions
    startScheduledJob,
    completeScheduledJob,
    refreshJobs: fetchScheduledJobs
  };
};