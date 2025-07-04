
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

// --- UPDATED TYPE: Enriched production job with 'categories' and manual SLA fields
export interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  date?: string | null;
  so_no?: string | null;
  qt_no?: string | null;
  rep?: string | null;
  user_name?: string | null;
  category?: string | null;
  customer?: string | null;
  reference?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  highlighted?: boolean;
  qr_code_data?: string | null;
  qr_code_url?: string | null;
  created_at?: string;
  updated_at?: string;
  has_custom_workflow?: boolean;
  manual_due_date?: string | null;
  manual_sla_days?: number | null;
  // Batch-related fields
  batch_category?: string | null;
  batch_ready?: boolean;
  is_batch_master?: boolean;
  batch_name?: string | null;
  constituent_job_count?: number;
  is_in_batch_processing?: boolean;
  // Enriched join: categories (for SLA and color)
  categories?: {
    id: string;
    name: string;
    description?: string;
    color?: string;
    sla_target_days?: number | null;
  } | null;
  category_name?: string | null; // Helper for consistency
}

export const useProductionJobs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);

      // Get ALL production jobs first
      const { data: allJobs, error: allJobsError } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          status,
          category_id,
          has_custom_workflow,
          manual_due_date,
          manual_sla_days,
          categories (
            id,
            name,
            description,
            color,
            sla_target_days
          )
        `)
        .order('wo_no');

      if (allJobsError) {
        throw new Error(`Failed to fetch all jobs: ${allJobsError.message}`);
      }
      
      // Get workflow coverage
      const { data: allWorkflowJobs, error: workflowError } = await supabase
        .from('job_stage_instances')
        .select('job_id, status')
        .eq('job_table_name', 'production_jobs');

      if (workflowError) {
        throw new Error(`Failed to fetch workflow data: ${workflowError.message}`);
      }

      const jobsWithWorkflow = new Set(allWorkflowJobs?.map(j => j.job_id) || []);

      // Filter eligible jobs
      const eligibleJobs = [];

      allJobs?.forEach(job => {
        const hasCategory = job.category_id !== null;
        const hasCustomWorkflow = job.has_custom_workflow === true;
        const hasWorkflowStages = jobsWithWorkflow.has(job.id);
        const isCompleted = job.status === 'Completed';

        const isEligible = (hasCategory || hasCustomWorkflow || hasWorkflowStages) && !isCompleted;

        if (isEligible) {
          eligibleJobs.push(job.id);
        }
      });
      
      if (eligibleJobs.length === 0) {
        setJobs([]);
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('production_jobs')
        .select(`
          *,
          categories (
            id,
            name,
            description,
            color,
            sla_target_days
          )
        `)
        .in('id', eligibleJobs)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Failed to fetch final job data: ${fetchError.message}`);
      }

      // Get batch information for jobs
      const jobIds = (data ?? []).map(job => job.id);
      let batchLookup = new Map();
      
      try {
        const { data: batchRefs, error: batchError } = await supabase
          .from('batch_job_references')
          .select('production_job_id, batch_id')
          .in('production_job_id', jobIds);

        if (batchRefs && !batchError) {
          // Get unique batch IDs
          const batchIds = [...new Set(batchRefs.map(ref => ref.batch_id))];
          
          if (batchIds.length > 0) {
            const { data: batches, error: batchesError } = await supabase
              .from('batches')
              .select('id, name')
              .in('id', batchIds);

            if (batches && !batchesError) {
              // Create batch name lookup
              const batchNames = new Map();
              batches.forEach(batch => {
                batchNames.set(batch.id, batch.name);
              });

              // Map jobs to batch names
              batchRefs.forEach(ref => {
                const batchName = batchNames.get(ref.batch_id);
                if (batchName) {
                  batchLookup.set(ref.production_job_id, batchName);
                }
              });
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch batch information:', error);
      }
      
      // Enrich jobs with helpers and batch context
      const jobsWithHelpers = (data ?? []).map((job: any) => {
        const batchName = batchLookup.get(job.id);
        return {
          ...job,
          category_name: job.categories?.name ?? job.category ?? null,
          // Batch context
          batch_name: batchName || null,
          is_in_batch_processing: job.status === 'In Batch Processing',
          is_batch_master: job.wo_no?.startsWith('BATCH-') || false,
          constituent_job_count: job.is_batch_master ? job.qty : undefined,
        };
      });

      setJobs(jobsWithHelpers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Update job status method
  const updateJobStatus = useCallback(async (jobId: string, newStatus: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) {
        return false;
      }

      // Optimistically update the local state
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? { ...job, status: newStatus } : job
        )
      );

      return true;
    } catch (err) {
      return false;
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  // Optimized real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`production_jobs_all`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Optimistic update for status changes
            setJobs(prevJobs => 
              prevJobs.map(job => 
                job.id === payload.new.id ? { 
                  ...job, 
                  ...payload.new
                } : job
              )
            );
          } else {
            // Refetch for INSERT/DELETE to avoid stale data
            fetchJobs();
          }
        }
      )
      .subscribe((status) => {
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED && status !== REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
          setError("Real-time updates unavailable");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchJobs]);

  // Helper functions
  const getJobsByStatus = useCallback((status: string) => {
    return jobs.filter(job => (job.status || 'Unknown') === status);
  }, [jobs]);

  const getJobStats = useCallback(() => {
    // Get unique statuses from actual jobs instead of hardcoded list
    const uniqueStatuses = Array.from(new Set(jobs.map(job => job.status || 'Unknown')));
    const statusCounts: Record<string, number> = {};
    
    // Initialize counts
    uniqueStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count actual jobs
    jobs.forEach(job => {
      const status = job.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
      total: jobs.length,
      statusCounts
    };
  }, [jobs]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    fetchJobs,
    updateJobStatus,
    getJobsByStatus,
    getJobStats
  };
};
