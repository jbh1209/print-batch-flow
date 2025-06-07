
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SimpleFactoryJob {
  id: string;
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date?: string;
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_status: 'pending' | 'active' | 'completed' | 'awaiting_approval' | 'client_approved' | 'changes_requested';
  stage_order: number;
  proof_emailed_at?: string;
  client_email?: string;
  client_name?: string;
  notes?: string;
}

export const useSimpleFactoryJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<SimpleFactoryJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First get job stage instances with stage details
      const { data: stageInstances, error: stageError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          status,
          stage_order,
          proof_emailed_at,
          client_email,
          client_name,
          notes,
          production_stages (
            name,
            color
          )
        `)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['pending', 'active', 'awaiting_approval', 'client_approved', 'changes_requested'])
        .order('stage_order');

      if (stageError) {
        throw stageError;
      }

      if (!stageInstances || stageInstances.length === 0) {
        setJobs([]);
        return;
      }

      // Get unique job IDs
      const jobIds = [...new Set(stageInstances.map(si => si.job_id))];

      // Get job details separately
      const { data: jobDetails, error: jobError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, status, due_date')
        .in('id', jobIds);

      if (jobError) {
        throw jobError;
      }

      // Create a map of job details for quick lookup
      const jobDetailsMap = new Map(
        (jobDetails || []).map(job => [job.id, job])
      );

      // Transform to simplified format
      const transformedJobs: SimpleFactoryJob[] = stageInstances.map(instance => {
        const jobDetail = jobDetailsMap.get(instance.job_id);
        
        return {
          id: instance.id,
          job_id: instance.job_id,
          wo_no: jobDetail?.wo_no || 'Unknown',
          customer: jobDetail?.customer || 'Unknown',
          status: jobDetail?.status || 'Unknown',
          due_date: jobDetail?.due_date || undefined,
          stage_id: instance.production_stage_id,
          stage_name: instance.production_stages?.name || 'Unknown Stage',
          stage_color: instance.production_stages?.color || '#6B7280',
          stage_status: instance.status as any,
          stage_order: instance.stage_order,
          proof_emailed_at: instance.proof_emailed_at || undefined,
          client_email: instance.client_email || undefined,
          client_name: instance.client_name || undefined,
          notes: instance.notes || undefined
        };
      });

      setJobs(transformedJobs);
    } catch (err) {
      console.error('❌ Error fetching factory jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      toast.error('Failed to fetch jobs');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Real-time subscription
  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel('factory-jobs-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances'
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchJobs]);

  return {
    jobs,
    isLoading,
    error,
    refreshJobs: fetchJobs
  };
};
