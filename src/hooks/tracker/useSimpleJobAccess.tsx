import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSimplePermissions } from "./useSimplePermissions";
import { toast } from "sonner";
import { SimpleFactoryJob } from "./useSimpleFactoryJobs";

export interface SimpleJobAccessOptions {
  statusFilter?: string;
  stageFilter?: string;
  searchQuery?: string;
}

export const useSimpleJobAccess = (options: SimpleJobAccessOptions = {}) => {
  const { user } = useAuth();
  const { permissions, isLoading: permissionsLoading } = useSimplePermissions();
  const [jobs, setJobs] = useState<SimpleFactoryJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!user?.id || permissionsLoading) {
      setJobs([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Simplified query - get all stage instances that match user's accessible stages
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

      // Get job details
      const { data: jobDetails, error: jobError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, status, due_date')
        .in('id', jobIds);

      if (jobError) {
        throw jobError;
      }

      // Create job details map
      const jobDetailsMap = new Map(
        (jobDetails || []).map(job => [job.id, job])
      );

      // Transform to simplified format and apply simple filtering
      let transformedJobs: SimpleFactoryJob[] = stageInstances
        .filter(instance => {
          const stageName = instance.production_stages?.name?.toLowerCase() || '';
          
          // Simple stage access check - if user is admin, show everything
          if (permissions.isAdmin) {
            return true;
          }
          
          // Otherwise check if stage name matches user's accessible stages
          return permissions.accessibleStageNames.some(accessibleStage => 
            stageName.includes(accessibleStage.toLowerCase())
          );
        })
        .map(instance => {
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

      // Apply user filters
      if (options.statusFilter) {
        transformedJobs = transformedJobs.filter(job => 
          job.status === options.statusFilter
        );
      }

      if (options.stageFilter) {
        transformedJobs = transformedJobs.filter(job => 
          job.stage_id === options.stageFilter
        );
      }

      if (options.searchQuery) {
        const query = options.searchQuery.toLowerCase();
        transformedJobs = transformedJobs.filter(job => 
          job.wo_no.toLowerCase().includes(query) ||
          job.customer.toLowerCase().includes(query)
        );
      }

      setJobs(transformedJobs);
    } catch (err) {
      console.error('❌ Error fetching jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      toast.error('Failed to fetch jobs');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissions, permissionsLoading, options.statusFilter, options.stageFilter, options.searchQuery]);

  return {
    jobs,
    isLoading: isLoading || permissionsLoading,
    error,
    refreshJobs: fetchJobs
  };
};
