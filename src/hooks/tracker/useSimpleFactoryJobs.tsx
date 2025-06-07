
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

      // Get jobs that user can work on - simplified query
      const { data, error: fetchError } = await supabase
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
          production_stage:production_stages(
            name,
            color
          ),
          production_jobs!job_stage_instances_job_id_fkey(
            wo_no,
            customer,
            status,
            due_date
          )
        `)
        .in('status', ['pending', 'active', 'awaiting_approval', 'client_approved', 'changes_requested'])
        .order('stage_order');

      if (fetchError) {
        throw fetchError;
      }

      // Transform to simplified format
      const transformedJobs: SimpleFactoryJob[] = (data || []).map(item => ({
        id: item.id,
        job_id: item.job_id,
        wo_no: item.production_jobs?.wo_no || 'Unknown',
        customer: item.production_jobs?.customer || 'Unknown',
        status: item.production_jobs?.status || 'Unknown',
        due_date: item.production_jobs?.due_date || undefined,
        stage_id: item.production_stage_id,
        stage_name: item.production_stage?.name || 'Unknown Stage',
        stage_color: item.production_stage?.color || '#6B7280',
        stage_status: item.status as any,
        stage_order: item.stage_order,
        proof_emailed_at: item.proof_emailed_at || undefined,
        client_email: item.client_email || undefined,
        client_name: item.client_name || undefined,
        notes: item.notes || undefined
      }));

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
