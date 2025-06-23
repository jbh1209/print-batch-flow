
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useUnifiedJobFiltering } from "@/hooks/tracker/useUnifiedJobFiltering";

interface DiagnosticResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  data: any;
  count?: number;
  message?: string;
}

export const DataFlowDiagnostic = () => {
  const { user } = useAuth();
  const { accessibleStages, isLoading: permissionsLoading } = useUserStagePermissions(user?.id);
  const { jobs, isLoading: jobsLoading } = useEnhancedProductionJobs();
  const { filteredJobs } = useUnifiedJobFiltering({ jobs });
  
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    try {
      // Step 1: Check user authentication
      results.push({
        step: "1. User Authentication",
        status: user ? 'success' : 'error',
        data: { userId: user?.id, email: user?.email },
        message: user ? 'User authenticated' : 'No user found'
      });

      if (!user) {
        setDiagnostics(results);
        setIsRunning(false);
        return;
      }

      // Step 2: Raw database - user groups
      const { data: userGroupsData, error: userGroupsError } = await supabase
        .from('user_group_memberships')
        .select(`
          *,
          user_groups:group_id (*)
        `)
        .eq('user_id', user.id);

      results.push({
        step: "2. User Group Memberships",
        status: userGroupsError ? 'error' : (userGroupsData?.length > 0 ? 'success' : 'warning'),
        data: userGroupsData,
        count: userGroupsData?.length,
        message: userGroupsError?.message || `Found ${userGroupsData?.length || 0} group memberships`
      });

      // Step 3: Raw database - stage permissions
      const { data: stagePermissionsData, error: stagePermissionsError } = await supabase
        .from('user_group_stage_permissions')
        .select(`
          *,
          production_stages (*)
        `)
        .in('user_group_id', userGroupsData?.map(ug => ug.group_id) || []);

      results.push({
        step: "3. Stage Permissions (Raw)",
        status: stagePermissionsError ? 'error' : (stagePermissionsData?.length > 0 ? 'success' : 'warning'),
        data: stagePermissionsData,
        count: stagePermissionsData?.length,
        message: stagePermissionsError?.message || `Found ${stagePermissionsData?.length || 0} stage permissions`
      });

      // Step 4: RPC function - accessible stages
      const { data: rpcStagesData, error: rpcStagesError } = await supabase
        .rpc('get_user_accessible_stages', { p_user_id: user.id });

      results.push({
        step: "4. RPC Accessible Stages",
        status: rpcStagesError ? 'error' : (rpcStagesData?.length > 0 ? 'success' : 'warning'),
        data: rpcStagesData,
        count: rpcStagesData?.length,
        message: rpcStagesError?.message || `RPC returned ${rpcStagesData?.length || 0} accessible stages`
      });

      // Step 5: Hook - user stage permissions
      results.push({
        step: "5. useUserStagePermissions Hook",
        status: permissionsLoading ? 'warning' : (accessibleStages?.length > 0 ? 'success' : 'error'),
        data: accessibleStages,
        count: accessibleStages?.length,
        message: permissionsLoading ? 'Still loading...' : `Hook returned ${accessibleStages?.length || 0} accessible stages`
      });

      // Step 6: Raw database - production jobs
      const { data: rawJobsData, error: rawJobsError } = await supabase
        .from('production_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      results.push({
        step: "6. Raw Production Jobs",
        status: rawJobsError ? 'error' : (rawJobsData?.length > 0 ? 'success' : 'warning'),
        data: rawJobsData,
        count: rawJobsData?.length,
        message: rawJobsError?.message || `Found ${rawJobsData?.length || 0} production jobs in database`
      });

      // Step 7: Job stage instances for those jobs
      const jobIds = rawJobsData?.map(job => job.id) || [];
      const { data: stageInstancesData, error: stageInstancesError } = await supabase
        .from('job_stage_instances')
        .select(`
          *,
          production_stages (*)
        `)
        .in('job_id', jobIds)
        .eq('job_table_name', 'production_jobs');

      results.push({
        step: "7. Job Stage Instances",
        status: stageInstancesError ? 'error' : 'success',
        data: stageInstancesData,
        count: stageInstancesData?.length,
        message: stageInstancesError?.message || `Found ${stageInstancesData?.length || 0} stage instances for ${jobIds.length} jobs`
      });

      // Step 8: Enhanced production jobs hook
      results.push({
        step: "8. useEnhancedProductionJobs Hook",
        status: jobsLoading ? 'warning' : (jobs?.length > 0 ? 'success' : 'error'),
        data: jobs?.slice(0, 3),
        count: jobs?.length,
        message: jobsLoading ? 'Still loading...' : `Hook returned ${jobs?.length || 0} enhanced jobs`
      });

      // Step 9: Unified job filtering
      results.push({
        step: "9. useUnifiedJobFiltering Hook",
        status: filteredJobs?.length > 0 ? 'success' : 'error',
        data: filteredJobs?.slice(0, 3),
        count: filteredJobs?.length,
        message: `Filtering returned ${filteredJobs?.length || 0} accessible jobs`
      });

      // Step 10: Manual access check
      if (jobs?.length > 0 && accessibleStages?.length > 0) {
        const accessibleStageIds = accessibleStages.map(s => s.stage_id);
        const accessibleStageNames = accessibleStages.map(s => s.stage_name.toLowerCase());
        
        const manualCheck = jobs.map(job => {
          const hasAccessibleWorkflowStages = job.stages?.some((stage: any) => {
            const stageId = stage.production_stage_id;
            const stageName = stage.stage_name;
            const hasIdAccess = stageId && accessibleStageIds.includes(stageId);
            const hasNameAccess = stageName && accessibleStageNames.includes(stageName.toLowerCase());
            const isWorkableStatus = ['active', 'pending'].includes(stage.status);
            return (hasIdAccess || hasNameAccess) && isWorkableStatus;
          }) || false;

          const currentStageAccessible = job.current_stage && 
            accessibleStageNames.includes(job.current_stage.toLowerCase());

          return {
            wo_no: job.wo_no,
            current_stage: job.current_stage,
            status: job.status,
            has_workflow: job.has_workflow,
            stages_count: job.stages?.length || 0,
            hasAccessibleWorkflowStages,
            currentStageAccessible,
            isAccessible: hasAccessibleWorkflowStages || currentStageAccessible
          };
        });

        results.push({
          step: "10. Manual Access Check",
          status: manualCheck.some(j => j.isAccessible) ? 'success' : 'error',
          data: manualCheck,
          count: manualCheck.filter(j => j.isAccessible).length,
          message: `Manual check: ${manualCheck.filter(j => j.isAccessible).length} of ${manualCheck.length} jobs accessible`
        });
      }

    } catch (error) {
      results.push({
        step: "Error",
        status: 'error',
        data: error,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  useEffect(() => {
    if (user && !isRunning) {
      runDiagnostics();
    }
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Data Flow Diagnostic</h2>
        <Button onClick={runDiagnostics} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run Diagnostics'}
        </Button>
      </div>

      <div className="space-y-4">
        {diagnostics.map((result, index) => (
          <Card key={index} className={`border-l-4 ${
            result.status === 'success' ? 'border-l-green-500' : 
            result.status === 'error' ? 'border-l-red-500' : 
            'border-l-yellow-500'
          }`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>{result.step}</span>
                <div className="flex items-center gap-2">
                  {result.count !== undefined && (
                    <span className="text-sm text-gray-500">Count: {result.count}</span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.status)}`}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
              </CardTitle>
              {result.message && (
                <p className="text-sm text-gray-600">{result.message}</p>
              )}
            </CardHeader>
            <CardContent>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  View Data
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-60">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
