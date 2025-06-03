
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";

interface DiagnosticStep {
  step: string;
  status: 'success' | 'error' | 'warning' | 'info';
  count: number;
  details: any;
  recommendation?: string;
}

export const FactoryFloorDiagnostic = () => {
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<DiagnosticStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostic = async () => {
    if (!user) return;
    
    setIsRunning(true);
    const results: DiagnosticStep[] = [];

    try {
      // Step 1: Check user groups
      const { data: userGroups, error: groupsError } = await supabase
        .from('user_group_memberships')
        .select(`
          *,
          user_groups:group_id (
            id,
            name,
            description
          )
        `)
        .eq('user_id', user.id);

      results.push({
        step: "User Group Memberships",
        status: groupsError ? 'error' : (userGroups?.length > 0 ? 'success' : 'error'),
        count: userGroups?.length || 0,
        details: userGroups,
        recommendation: userGroups?.length === 0 ? "User needs to be assigned to user groups first!" : undefined
      });

      // Step 2: Check stage permissions for user's groups
      if (userGroups?.length > 0) {
        const groupIds = userGroups.map(ug => ug.group_id);
        
        const { data: stagePermissions, error: permError } = await supabase
          .from('user_group_stage_permissions')
          .select(`
            *,
            production_stages (
              id,
              name,
              color
            )
          `)
          .in('user_group_id', groupIds);

        results.push({
          step: "Stage Permissions",
          status: permError ? 'error' : (stagePermissions?.length > 0 ? 'success' : 'error'),
          count: stagePermissions?.length || 0,
          details: stagePermissions,
          recommendation: stagePermissions?.length === 0 ? "User groups need stage permissions assigned!" : undefined
        });

        // Step 3: Check workable permissions specifically
        const workablePermissions = stagePermissions?.filter(p => p.can_work) || [];
        results.push({
          step: "Workable Stage Permissions",
          status: workablePermissions.length > 0 ? 'success' : 'error',
          count: workablePermissions.length,
          details: workablePermissions,
          recommendation: workablePermissions.length === 0 ? "User needs 'can_work' permissions on stages!" : undefined
        });

        // Step 4: Check jobs with those stages
        if (workablePermissions.length > 0) {
          const workableStageIds = workablePermissions.map(p => p.production_stage_id);
          
          const { data: jobsWithStages, error: jobsError } = await supabase
            .from('job_stage_instances')
            .select(`
              *,
              production_jobs!inner (
                id,
                wo_no,
                customer,
                status
              )
            `)
            .in('production_stage_id', workableStageIds)
            .in('status', ['active', 'pending']);

          results.push({
            step: "Jobs with Workable Stages",
            status: jobsError ? 'error' : (jobsWithStages?.length > 0 ? 'success' : 'warning'),
            count: jobsWithStages?.length || 0,
            details: jobsWithStages,
            recommendation: jobsWithStages?.length === 0 ? "No jobs currently in workable stages" : undefined
          });
        }
      }

      // Step 5: Check all production jobs
      const { data: allJobs, error: allJobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, status, customer')
        .limit(10);

      results.push({
        step: "Total Production Jobs",
        status: allJobsError ? 'error' : (allJobs?.length > 0 ? 'info' : 'warning'),
        count: allJobs?.length || 0,
        details: allJobs,
        recommendation: allJobs?.length === 0 ? "No jobs exist in system" : undefined
      });

      // Step 6: Check all production stages
      const { data: allStages, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name, color, is_active')
        .eq('is_active', true);

      results.push({
        step: "Active Production Stages",
        status: stagesError ? 'error' : (allStages?.length > 0 ? 'info' : 'warning'),
        count: allStages?.length || 0,
        details: allStages
      });

    } catch (error) {
      results.push({
        step: "Diagnostic Error",
        status: 'error',
        count: 0,
        details: error,
        recommendation: "Contact system administrator"
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  useEffect(() => {
    if (user) {
      runDiagnostic();
    }
  }, [user]);

  const getIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Factory Floor Diagnostic</h1>
        <Button onClick={runDiagnostic} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Re-run Diagnostic'}
        </Button>
      </div>

      <div className="space-y-4">
        {diagnostics.map((result, index) => (
          <Card key={index} className={`${getStatusColor(result.status)} border-l-4`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getIcon(result.status)}
                  <span>{result.step}</span>
                </div>
                <Badge variant="outline">
                  Count: {result.count}
                </Badge>
              </CardTitle>
              {result.recommendation && (
                <div className="text-sm font-medium text-red-600 bg-red-100 p-2 rounded">
                  ⚠️ {result.recommendation}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  View Details
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      {diagnostics.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Quick Fix Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">To fix user access issues:</div>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Assign user to appropriate user groups</li>
              <li>Grant 'can_work' permissions to user groups on production stages</li>
              <li>Ensure jobs exist with stage instances in 'active' or 'pending' status</li>
              <li>Verify production stages are marked as 'active'</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
