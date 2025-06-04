
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
    permissionType = 'work',
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

      console.log("🔍 Starting fetchJobs with comprehensive debugging...", {
        userId: user.id,
        permissionType,
        statusFilter,
        stageFilter
      });

      // Step 1: Check user groups
      console.log("📋 Step 1: Checking user group memberships...");
      const { data: userGroups, error: groupError } = await supabase
        .from('user_group_memberships')
        .select(`
          group_id,
          user_groups (
            id,
            name,
            description
          )
        `)
        .eq('user_id', user.id);

      if (groupError) {
        console.error("❌ Error fetching user groups:", groupError);
        throw new Error(`Failed to get user groups: ${groupError.message}`);
      }

      console.log("👥 User groups found:", {
        count: userGroups?.length || 0,
        groups: userGroups?.map(ug => ({
          id: ug.group_id,
          name: ug.user_groups?.name
        })) || []
      });

      if (!userGroups || userGroups.length === 0) {
        console.log("⚠️ User has no group memberships - this explains why no jobs are visible");
        setJobs([]);
        setError("No group memberships found. Please contact an administrator to assign you to the appropriate groups.");
        return;
      }

      const groupIds = userGroups.map(ug => ug.group_id);

      // Step 2: Check stage permissions
      console.log("📋 Step 2: Checking stage permissions for groups...");
      const { data: stagePermissions, error: permError } = await supabase
        .from('user_group_stage_permissions')
        .select(`
          production_stage_id,
          can_view,
          can_edit,
          can_work,
          can_manage,
          production_stages (
            id,
            name,
            color
          )
        `)
        .in('user_group_id', groupIds);

      if (permError) {
        console.error("❌ Error fetching stage permissions:", permError);
        throw new Error(`Failed to get stage permissions: ${permError.message}`);
      }

      console.log("🎯 Stage permissions found:", {
        count: stagePermissions?.length || 0,
        permissions: stagePermissions?.map(sp => ({
          stageId: sp.production_stage_id,
          stageName: sp.production_stages?.name,
          canView: sp.can_view,
          canEdit: sp.can_edit,
          canWork: sp.can_work,
          canManage: sp.can_manage
        })) || []
      });

      if (!stagePermissions || stagePermissions.length === 0) {
        console.log("⚠️ User groups have no stage permissions - this explains why no jobs are visible");
        setJobs([]);
        setError("No stage permissions found for your groups. Please contact an administrator to configure stage permissions.");
        return;
      }

      // Filter permissions based on requested permission type
      const relevantPermissions = stagePermissions.filter(sp => {
        switch (permissionType) {
          case 'view': return sp.can_view;
          case 'edit': return sp.can_edit;
          case 'work': return sp.can_work;
          case 'manage': return sp.can_manage;
          default: return sp.can_view;
        }
      });

      console.log(`🔍 Relevant permissions for '${permissionType}':`, {
        count: relevantPermissions.length,
        stageIds: relevantPermissions.map(rp => rp.production_stage_id)
      });

      if (relevantPermissions.length === 0) {
        console.log(`⚠️ User has no '${permissionType}' permissions on any stages`);
        setJobs([]);
        setError(`No '${permissionType}' permissions found. Please contact an administrator to configure appropriate permissions.`);
        return;
      }

      const accessibleStageIds = relevantPermissions.map(rp => rp.production_stage_id);

      // Step 3: Find jobs with accessible stages
      console.log("📋 Step 3: Finding jobs with accessible current stages...");
      const { data: jobStageInstances, error: instanceError } = await supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          job_table_name,
          production_stage_id,
          status,
          stage_order,
          production_stages (
            id,
            name,
            color
          )
        `)
        .in('production_stage_id', accessibleStageIds)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['active', 'pending']);

      if (instanceError) {
        console.error("❌ Error fetching job stage instances:", instanceError);
        throw new Error(`Failed to get job instances: ${instanceError.message}`);
      }

      console.log("📊 Job stage instances found:", {
        count: jobStageInstances?.length || 0,
        jobIds: [...new Set(jobStageInstances?.map(jsi => jsi.job_id) || [])]
      });

      if (!jobStageInstances || jobStageInstances.length === 0) {
        console.log("⚠️ No jobs found with accessible current stages");
        setJobs([]);
        return;
      }

      // Get unique job IDs
      const jobIds = [...new Set(jobStageInstances.map(jsi => jsi.job_id))];

      // Step 4: Get actual job data
      console.log("📋 Step 4: Fetching production job data...");
      const { data: productionJobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('*')
        .in('id', jobIds);

      if (jobsError) {
        console.error("❌ Error fetching production jobs:", jobsError);
        throw new Error(`Failed to get production jobs: ${jobsError.message}`);
      }

      console.log("🏭 Production jobs found:", {
        count: productionJobs?.length || 0,
        jobNumbers: productionJobs?.map(pj => pj.wo_no) || []
      });

      // Step 5: Try the database function as well for comparison
      console.log("📋 Step 5: Trying database function for comparison...");
      const { data: dbFunctionData, error: functionError } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: stageFilter
      });

      if (functionError) {
        console.warn("⚠️ Database function failed:", functionError);
      } else {
        console.log("🔧 Database function results:", {
          count: dbFunctionData?.length || 0,
          sample: dbFunctionData?.slice(0, 3).map(job => ({
            wo_no: job.wo_no,
            current_stage_name: job.current_stage_name,
            current_stage_status: job.current_stage_status,
            user_can_work: job.user_can_work
          })) || []
        });

        if (dbFunctionData && dbFunctionData.length > 0) {
          // Use database function results if available
          const normalizedJobs = dbFunctionData
            .filter(job => job && typeof job === 'object')
            .map((job, index) => normalizeJobData(job, index))
            .filter(job => job !== null) as AccessibleJob[];

          console.log("✅ Using database function results:", normalizedJobs.length, "jobs");
          setJobs(normalizedJobs);
          return;
        }
      }

      // Step 6: Manual data assembly if needed
      console.log("📋 Step 6: Manually assembling job data...");
      const assembledJobs = productionJobs?.map(job => {
        // Find current stage for this job
        const currentStageInstance = jobStageInstances.find(jsi => 
          jsi.job_id === job.id && 
          jsi.status === 'active'
        ) || jobStageInstances.find(jsi => 
          jsi.job_id === job.id && 
          jsi.status === 'pending'
        );

        if (!currentStageInstance) {
          console.log(`⚠️ No current stage found for job ${job.wo_no}`);
          return null;
        }

        // Find user permissions for this stage
        const stagePermission = relevantPermissions.find(rp => 
          rp.production_stage_id === currentStageInstance.production_stage_id
        );

        return {
          job_id: job.id,
          wo_no: job.wo_no || '',
          customer: job.customer || 'Unknown',
          status: job.status || 'Unknown',
          due_date: job.due_date?.toString() || '',
          category_id: job.category_id,
          category_name: null,
          category_color: null,
          current_stage_id: currentStageInstance.production_stage_id,
          current_stage_name: currentStageInstance.production_stages?.name || '',
          current_stage_color: currentStageInstance.production_stages?.color || '',
          current_stage_status: currentStageInstance.status,
          user_can_view: stagePermission?.can_view || false,
          user_can_edit: stagePermission?.can_edit || false,
          user_can_work: stagePermission?.can_work || false,
          user_can_manage: stagePermission?.can_manage || false,
          workflow_progress: 0,
          total_stages: 0,
          completed_stages: 0
        };
      }).filter(Boolean) || [];

      console.log("🔧 Manually assembled jobs:", assembledJobs.length);
      setJobs(assembledJobs as AccessibleJob[]);
      
    } catch (err) {
      console.error('❌ Error in fetchJobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      setError(errorMessage);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const { startJob, completeJob } = useJobActions(fetchJobs);
  
  // Only set up realtime if we have jobs data
  useRealtimeSubscription(fetchJobs);

  // Initial data load
  useEffect(() => {
    console.log("🔄 useAccessibleJobs effect triggered", {
      authLoading,
      userId: user?.id
    });
    
    if (!authLoading && user?.id) {
      fetchJobs();
    } else if (!authLoading && !user?.id) {
      setIsLoading(false);
      setJobs([]);
    }
  }, [authLoading, user?.id, fetchJobs]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchJobs
  };
};
