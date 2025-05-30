
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobStageWithDetails {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  stage_order: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  notes?: string;
  production_stage: {
    id: string;
    name: string;
    color: string;
    description?: string;
  };
  production_job?: {
    id: string;
    wo_no: string;
    customer?: string;
    category?: string;
    due_date?: string;
  };
}

export const useRealTimeJobStages = (jobs: any[] = []) => {
  const [jobStages, setJobStages] = useState<JobStageWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchJobStages = useCallback(async () => {
    if (jobs.length === 0) {
      setJobStages([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('🔄 Fetching real-time job stages...');

      const { data, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select(`
          *,
          production_stage:production_stages(
            id,
            name,
            color,
            description
          )
        `)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order');

      if (fetchError) throw fetchError;

      // Enrich with job details
      const enrichedStages: JobStageWithDetails[] = (data || [])
        .map(stage => {
          const job = jobs.find(j => j.id === stage.job_id);
          return {
            ...stage,
            status: stage.status as 'pending' | 'active' | 'completed' | 'skipped',
            production_stage: stage.production_stage as {
              id: string;
              name: string;
              color: string;
              description?: string;
            },
            production_job: job ? {
              id: job.id,
              wo_no: job.wo_no,
              customer: job.customer,
              category: job.category,
              due_date: job.due_date
            } : undefined
          };
        })
        .filter(stage => stage.production_job); // Only show stages with valid jobs

      setJobStages(enrichedStages);
      setLastUpdate(new Date());
      console.log('✅ Real-time job stages fetched:', enrichedStages.length);
    } catch (err) {
      console.error('❌ Error fetching real-time job stages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load job stages');
    } finally {
      setIsLoading(false);
    }
  }, [jobs]);

  // Initial fetch
  useEffect(() => {
    fetchJobStages();
  }, [fetchJobStages]);

  // Real-time subscription
  useEffect(() => {
    if (jobs.length === 0) return;

    console.log('🔄 Setting up real-time subscription for job stages...');

    const channel = supabase
      .channel('job_stage_instances_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances'
        },
        (payload) => {
          console.log('📡 Real-time job stage change:', payload.eventType, payload);
          
          // Optimistic update for better UX
          if (payload.eventType === 'UPDATE' && payload.new) {
            setJobStages(prevStages => 
              prevStages.map(stage => 
                stage.id === payload.new.id 
                  ? { ...stage, ...payload.new }
                  : stage
              )
            );
          }
          
          // Always refetch for data consistency
          setTimeout(fetchJobStages, 100);
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
      });

    return () => {
      console.log('🔄 Cleaning up real-time subscription...');
      supabase.removeChannel(channel);
    };
  }, [jobs, fetchJobStages]);

  // Stage action handlers
  const startStage = useCallback(async (stageId: string) => {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'pending');

      if (error) throw error;
      
      toast.success('Stage started successfully');
      return true;
    } catch (err) {
      console.error('❌ Error starting stage:', err);
      toast.error('Failed to start stage');
      return false;
    }
  }, []);

  const completeStage = useCallback(async (stageId: string, notes?: string) => {
    try {
      const stage = jobStages.find(s => s.id === stageId);
      if (!stage) throw new Error('Stage not found');

      const { data, error } = await supabase.rpc('advance_job_stage', {
        p_job_id: stage.job_id,
        p_job_table_name: stage.job_table_name,
        p_current_stage_id: stageId,
        p_notes: notes || null
      });

      if (error) throw error;
      if (!data) throw new Error('Failed to advance stage');

      toast.success('Stage completed successfully');
      return true;
    } catch (err) {
      console.error('❌ Error completing stage:', err);
      toast.error('Failed to complete stage');
      return false;
    }
  }, [jobStages]);

  // Analytics and metrics
  const getStageMetrics = useCallback(() => {
    const totalStages = jobStages.length;
    const activeStages = jobStages.filter(s => s.status === 'active').length;
    const pendingStages = jobStages.filter(s => s.status === 'pending').length;
    const completedStages = jobStages.filter(s => s.status === 'completed').length;
    const uniqueJobs = new Set(jobStages.map(s => s.job_id)).size;

    return {
      totalStages,
      activeStages,
      pendingStages,
      completedStages,
      uniqueJobs
    };
  }, [jobStages]);

  const getStagesByProductionStage = useCallback((productionStageId: string) => {
    return jobStages.filter(s => s.production_stage_id === productionStageId);
  }, [jobStages]);

  const getActiveStagesForJob = useCallback((jobId: string) => {
    return jobStages.filter(s => s.job_id === jobId && s.status === 'active');
  }, [jobStages]);

  return {
    jobStages,
    isLoading,
    error,
    lastUpdate,
    
    // Actions
    startStage,
    completeStage,
    refreshStages: fetchJobStages,
    
    // Analytics
    getStageMetrics,
    getStagesByProductionStage,
    getActiveStagesForJob
  };
};
