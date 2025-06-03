
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { normalizeJobData } from "./useAccessibleJobs/jobDataNormalizer";
import { handleDatabaseError } from "./useAccessibleJobs/errorHandler";
import { useJobActions } from "./useAccessibleJobs/useJobActions";
import { useRealtimeSubscription } from "./useAccessibleJobs/useRealtimeSubscription";
import type { AccessibleJob, UseAccessibleJobsOptions } from "./useAccessibleJobs/types";

export type { AccessibleJob, UseAccessibleJobsOptions };

export const useAccessibleJobs = (options: UseAccessibleJobsOptions = {}) => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<AccessibleJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    permissionType = 'view',
    statusFilter = null,
    stageFilter = null
  } = options;

  const fetchJobs = useCallback(async () => {
    if (!user?.id) {
      console.log("❌ No user ID available, skipping fetch");
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("🔍 Fetching accessible jobs via database function...", {
        userId: user.id,
        permissionType,
        statusFilter,
        stageFilter
      });

      // First, let's try a simple query to see if the basic connection works
      const { data: testData, error: testError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, status')
        .limit(5);

      if (testError) {
        console.error("❌ Basic query failed:", testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }

      console.log("✅ Basic query successful, found", testData?.length, "jobs");

      // Now try the function call
      const { data, error: fetchError } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: stageFilter
      });

      if (fetchError) {
        console.error("❌ Function call failed:", fetchError);
        // Fallback to basic query if function fails
        console.log("🔄 Falling back to basic query...");
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('production_jobs')
          .select(`
            *,
            categories (
              id,
              name,
              color
            )
          `)
          .order('created_at', { ascending: false });

        if (fallbackError) {
          throw new Error(`Fallback query failed: ${fallbackError.message}`);
        }

        // Convert fallback data to match expected format
        const normalizedFallbackJobs = (fallbackData || []).map((job: any) => ({
          job_id: job.id,
          wo_no: job.wo_no || '',
          customer: job.customer || 'Unknown',
          status: job.status || 'Unknown',
          due_date: job.due_date || '',
          category_id: job.category_id,
          category_name: job.categories?.name || '',
          category_color: job.categories?.color || '',
          current_stage_id: null,
          current_stage_name: job.status || 'Unknown',
          current_stage_color: '#6B7280',
          current_stage_status: 'pending',
          user_can_view: true,
          user_can_edit: true,
          user_can_work: true,
          user_can_manage: true,
          workflow_progress: 0,
          total_stages: 0,
          completed_stages: 0
        }));

        console.log("✅ Fallback query successful:", normalizedFallbackJobs.length, "jobs");
        setJobs(normalizedFallbackJobs);
        return;
      }

      console.log("✅ Function call successful, raw data:", data?.length, "jobs");

      // Validate and normalize the data to match our interface
      if (!Array.isArray(data)) {
        console.warn("⚠️ Database returned non-array data:", data);
        setJobs([]);
        return;
      }

      const normalizedJobs = data.map(normalizeJobData);

      console.log("✅ Normalized accessible jobs:", normalizedJobs.length);
      setJobs(normalizedJobs);
      
    } catch (err) {
      console.error('❌ Error fetching accessible jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      setError(errorMessage);
      toast.error(errorMessage);
      setJobs([]); // Set empty array on error to prevent UI crashes
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const { startJob, completeJob } = useJobActions(fetchJobs);
  useRealtimeSubscription(fetchJobs);

  // Initial data load
  useEffect(() => {
    console.log("🔄 useAccessibleJobs effect triggered", {
      authLoading,
      userId: user?.id
    });
    
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchJobs
  };
};
