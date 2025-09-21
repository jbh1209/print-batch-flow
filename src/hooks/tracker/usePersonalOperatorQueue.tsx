import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Helper function to fetch job specifications
const fetchJobSpecifications = async (jobId: string) => {
  try {
    // Fetch print specifications
    const { data: printSpecs } = await supabase.rpc('get_job_specifications', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs'
    });

    // Fetch HP12000 paper size info
    const { data: hp12000Data } = await supabase.rpc('get_job_hp12000_stages', {
      p_job_id: jobId
    });

    // Parse print specifications
    const printingSpecs = printSpecs?.find(spec => spec.category === 'printing');
    const paperSpecs = printSpecs?.filter(spec => ['paper_type', 'paper_weight'].includes(spec.category));
    
    // Build print specs string
    let printSpecsString = '';
    if (printingSpecs?.properties) {
      const props = printingSpecs.properties as any;
      if (props.colours && props.sides) {
        printSpecsString = `${props.colours} (${props.sides})`;
      } else if (props.colours) {
        printSpecsString = props.colours;
      }
    }

    // Build paper specs string
    let paperSpecsString = '';
    if (paperSpecs?.length > 0) {
      const paperType = paperSpecs.find(s => s.category === 'paper_type')?.display_name;
      const paperWeight = paperSpecs.find(s => s.category === 'paper_weight')?.display_name;
      if (paperWeight && paperType) {
        paperSpecsString = `${paperWeight} ${paperType}`;
      } else if (paperWeight) {
        paperSpecsString = paperWeight;
      } else if (paperType) {
        paperSpecsString = paperType;
      }
    }

    // Get sheet size from HP12000 data
    let sheetSize = '';
    if (hp12000Data?.length > 0) {
      const paperSize = hp12000Data[0]?.paper_size_name;
      if (paperSize) {
        // Determine if it's large or small sheet based on paper size name
        if (paperSize.includes('B1') || paperSize.includes('Large')) {
          sheetSize = 'Large Sheet';
        } else if (paperSize.includes('B2') || paperSize.includes('Small')) {
          sheetSize = 'Small Sheet';
        } else {
          sheetSize = paperSize;
        }
      }
    }

    return {
      print_specs: printSpecsString,
      paper_specs: paperSpecsString,
      sheet_size: sheetSize
    };
  } catch (error) {
    console.error('Error fetching job specifications:', error);
    return {
      print_specs: undefined,
      paper_specs: undefined,
      sheet_size: undefined
    };
  }
};

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
  // Print operator specifications
  print_specs?: string;
  paper_specs?: string;
  sheet_size?: string;
  // Additional fields for compatibility with TouchOptimizedJobCard
  completed_stages?: number;
  total_stages?: number;
  user_can_work?: boolean;
  current_stage_id?: string;
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
          production_jobs!inner(
            wo_no,
            customer,
            due_date,
            reference
          ),
          production_stages!inner(
            name
          ),
          categories(
            name,
            color
          )
        `)
        .eq('status', 'pending')
        .eq('started_by', effectiveOperatorId)
        .not('scheduled_start_at', 'is', null)
        .order('scheduled_start_at', { ascending: true })
        .limit(3);

      if (error) throw error;

      // Fetch specifications for each job
      const jobsWithSpecs = await Promise.all(
        data.map(async (item, index) => {
          const specs = await fetchJobSpecifications(item.job_id);
          
          return {
            job_id: item.job_id,
            job_stage_instance_id: item.id,
            wo_no: item.production_jobs.wo_no,
            customer: item.production_jobs.customer,
            current_stage_name: item.production_stages.name,
            current_stage_status: item.status as 'pending',
            scheduled_start_at: item.scheduled_start_at,
            estimated_duration_minutes: item.estimated_duration_minutes,
            due_date: item.production_jobs.due_date,
            priority_score: 0,
            queue_position: index + 1,
            workflow_progress: 0,
            reference: item.production_jobs.reference,
            category_name: item.categories?.name || 'No Category',
            category_color: item.categories?.color || '#6B7280',
            is_rush: false,
            print_specs: specs.print_specs,
            paper_specs: specs.paper_specs,
            sheet_size: specs.sheet_size,
            completed_stages: 0,
            total_stages: 1,
            user_can_work: true,
            current_stage_id: item.id,
          } as PersonalQueueJob;
        })
      );

      return jobsWithSpecs;
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
            reference
          ),
          production_stages!inner(
            name
          ),
          categories(
            name,
            color
          )
        `)
        .eq('status', 'active')
        .eq('started_by', effectiveOperatorId)
        .order('started_at', { ascending: true });

      if (error) throw error;

      // Fetch specifications for each active job
      const jobsWithSpecs = await Promise.all(
        data.map(async (item) => {
          const specs = await fetchJobSpecifications(item.job_id);
          
          return {
            job_id: item.job_id,
            job_stage_instance_id: item.id,
            wo_no: item.production_jobs.wo_no,
            customer: item.production_jobs.customer,
            current_stage_name: item.production_stages.name,
            current_stage_status: 'active',
            scheduled_start_at: item.started_at,
            estimated_duration_minutes: item.estimated_duration_minutes,
            due_date: item.production_jobs.due_date,
            priority_score: 1000,
            queue_position: 0,
            workflow_progress: 50,
            reference: item.production_jobs.reference,
            category_name: item.categories?.name || 'No Category',
            category_color: item.categories?.color || '#6B7280',
            is_rush: false,
            print_specs: specs.print_specs,
            paper_specs: specs.paper_specs,
            sheet_size: specs.sheet_size,
            completed_stages: 0,
            total_stages: 1,
            user_can_work: true,
            current_stage_id: item.id,
          } as PersonalQueueJob;
        })
      );

      return jobsWithSpecs;
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
            filter: `started_by=eq.${effectiveOperatorId}`,
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