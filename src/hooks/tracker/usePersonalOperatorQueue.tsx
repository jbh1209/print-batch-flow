import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PersonalQueueJob {
  job_id: string;
  job_stage_instance_id: string;
  wo_no: string;
  customer?: string;
  current_stage_name: string;
  current_stage_status: 'pending' | 'active' | 'completed';
  scheduled_start_at?: string;
  estimated_duration_minutes?: number;
  due_date?: string;
  priority_score: number;
  queue_position: number;
  workflow_progress: number;
  reference?: string;
  category_name?: string;
  category_color?: string;
  is_rush: boolean;
}

export const usePersonalOperatorQueue = (operatorId?: string) => {
  const { user } = useAuth();
  const effectiveOperatorId = operatorId || user?.id;

  const { data: myNextJobs = [], isLoading: isLoadingNext, refetch: refetchNext } = useQuery({
    queryKey: ['personal-next-jobs', effectiveOperatorId],
    queryFn: async () => {
      if (!effectiveOperatorId) return [];

      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          status,
          scheduled_start_at,
          estimated_duration_minutes,
          priority_score,
          production_jobs!inner(
            wo_no,
            customer,
            due_date,
            reference,
            category_name,
            category_color,
            is_rush
          ),
          production_stages!inner(
            name,
            department_id,
            production_departments!inner(
              name
            )
          )
        `)
        .eq('status', 'pending')
        .eq('assigned_user_id', effectiveOperatorId)
        .not('scheduled_start_at', 'is', null)
        .order('scheduled_start_at', { ascending: true })
        .limit(3);

      if (error) throw error;

      return data.map((item, index): PersonalQueueJob => ({
        job_id: item.job_id,
        job_stage_instance_id: item.id,
        wo_no: item.production_jobs.wo_no,
        customer: item.production_jobs.customer,
        current_stage_name: item.production_stages.name,
        current_stage_status: item.status as 'pending',
        scheduled_start_at: item.scheduled_start_at,
        estimated_duration_minutes: item.estimated_duration_minutes,
        due_date: item.production_jobs.due_date,
        priority_score: item.priority_score || 0,
        queue_position: index + 1,
        workflow_progress: 0, // Will be calculated separately if needed
        reference: item.production_jobs.reference,
        category_name: item.production_jobs.category_name,
        category_color: item.production_jobs.category_color,
        is_rush: item.production_jobs.is_rush || false,
      }));
    },
    enabled: !!effectiveOperatorId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: activeJobs = [], isLoading: isLoadingActive, refetch: refetchActive } = useQuery({
    queryKey: ['personal-active-jobs', effectiveOperatorId],
    queryFn: async () => {
      if (!effectiveOperatorId) return [];

      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          status,
          started_at,
          estimated_duration_minutes,
          production_jobs!inner(
            wo_no,
            customer,
            due_date,
            reference,
            category_name,
            category_color,
            is_rush
          ),
          production_stages!inner(
            name
          )
        `)
        .eq('status', 'active')
        .eq('assigned_user_id', effectiveOperatorId)
        .order('started_at', { ascending: true });

      if (error) throw error;

      return data.map((item): PersonalQueueJob => ({
        job_id: item.job_id,
        job_stage_instance_id: item.id,
        wo_no: item.production_jobs.wo_no,
        customer: item.production_jobs.customer,
        current_stage_name: item.production_stages.name,
        current_stage_status: 'active',
        scheduled_start_at: item.started_at,
        estimated_duration_minutes: item.estimated_duration_minutes,
        due_date: item.production_jobs.due_date,
        priority_score: 1000, // Active jobs have highest priority
        queue_position: 0, // Active jobs are position 0
        workflow_progress: 50, // Assume halfway through active stage
        reference: item.production_jobs.reference,
        category_name: item.production_jobs.category_name,
        category_color: item.production_jobs.category_color,
        is_rush: item.production_jobs.is_rush || false,
      }));
    },
    enabled: !!effectiveOperatorId,
    refetchInterval: 10000, // Refresh every 10 seconds for active jobs
  });

  // Set up real-time subscriptions
  useEffect(() => {
    if (!effectiveOperatorId) return;

    const channel = supabase
      .channel('personal-queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
          filter: `assigned_user_id=eq.${effectiveOperatorId}`,
        },
        () => {
          refetchNext();
          refetchActive();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveOperatorId, refetchNext, refetchActive]);

  const refetch = () => {
    refetchNext();
    refetchActive();
  };

  return {
    myNextJobs,
    activeJobs,
    allPersonalJobs: [...activeJobs, ...myNextJobs],
    isLoading: isLoadingNext || isLoadingActive,
    refetch,
  };
};