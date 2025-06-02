import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useAuth } from "@/hooks/useAuth";

export const OperatorDashboard = () => {
  const { user } = useAuth();
  const { accessibleStages, isLoading, canWorkWithStage } = useUserStagePermissions(user?.id);
  const { jobs, isLoading: jobsLoading } = useEnhancedProductionJobs();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Add refresh logic here
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Extract accessible stage IDs and names for filtering
  const accessibleStageIds = accessibleStages.map(stage => stage.stage_id);
  const accessibleStageNames = accessibleStages.map(stage => stage.stage_name);
  
  console.log("🔍 Operator Dashboard Debug Info:", {
    userId: user?.id,
    totalJobs: jobs.length,
    accessibleStages: accessibleStages.length,
    accessibleStageIds,
    accessibleStageNames,
    stageNames: accessibleStages.map(s => s.stage_name)
  });

  // Improved job filtering logic with comprehensive debugging
  const userJobs = jobs.filter(job => {
    console.log("🔍 Checking job:", {
      woNo: job.wo_no,
      jobId: job.id,
      hasStages: !!job.stages,
      stagesCount: job.stages?.length || 0,
      currentStage: job.current_stage,
      status: job.status,
      hasWorkflow: job.has_workflow,
      stageDetails: job.stages?.map(s => ({
        stageId: s.production_stage_id,
        stageName: s.stage_name,
        status: s.status
      })) || []
    });

    // Method 1: Check if job has stage instances that match user's accessible stages
    const hasAccessibleStageInstances = job.stages?.some(stage => {
      const stageId = stage.production_stage_id || stage.stage_id;
      const hasAccess = accessibleStageIds.includes(stageId);
      const isActiveOrPending = ['active', 'pending'].includes(stage.status);
      
      console.log("  📋 Stage instance check:", {
        stageName: stage.stage_name,
        stageId: stageId,
        status: stage.status,
        hasAccess,
        isActiveOrPending,
        accessibleStageIds
      });
      
      return hasAccess && isActiveOrPending;
    });

    // Method 2: Check jobs without workflow but with accessible current stage name
    const hasAccessibleCurrentStage = job.current_stage && 
      accessibleStageNames.some(stageName => 
        stageName.toLowerCase() === job.current_stage.toLowerCase()
      );

    // Method 3: For jobs without workflow, check if their status matches accessible stage names
    const statusMatchesAccessibleStage = job.status && 
      accessibleStageNames.some(stageName => 
        stageName.toLowerCase() === job.status.toLowerCase()
      );

    // Method 4: Handle DTP stage specifically (case-insensitive)
    const isDTPJob = (job.status?.toLowerCase() === 'dtp' || 
                     job.current_stage?.toLowerCase() === 'dtp') &&
                     accessibleStageNames.some(stage => stage.toLowerCase() === 'dtp');

    // Include jobs that are not yet completed and have accessible stages
    const isNotCompleted = !['completed', 'shipped'].includes(job.status?.toLowerCase() || '');
    
    const shouldInclude = isNotCompleted && (
      hasAccessibleStageInstances || 
      hasAccessibleCurrentStage || 
      statusMatchesAccessibleStage ||
      isDTPJob
    );
    
    console.log("  ✅ Job decision:", {
      woNo: job.wo_no,
      hasAccessibleStageInstances,
      hasAccessibleCurrentStage,
      statusMatchesAccessibleStage,
      isDTPJob,
      isNotCompleted,
      shouldInclude,
      finalDecision: shouldInclude ? "INCLUDE" : "EXCLUDE"
    });

    return shouldInclude;
  });

  console.log("📊 Final user jobs:", userJobs.length, "out of", jobs.length, "total jobs");

  const pendingJobs = userJobs.filter(job => {
    const hasPendingStages = job.stages?.some(stage => 
      accessibleStageIds.includes(stage.production_stage_id) && 
      stage.status === 'pending'
    );
    const isPending = job.status?.toLowerCase() === 'pending';
    const isDTP = job.status?.toLowerCase() === 'dtp' || job.current_stage?.toLowerCase() === 'dtp';
    return hasPendingStages || isPending || isDTP;
  });

  const inProgressJobs = userJobs.filter(job => {
    const hasActiveStages = job.stages?.some(stage => 
      accessibleStageIds.includes(stage.production_stage_id) && 
      stage.status === 'active'
    );
    const isInProgress = ['in-progress', 'active'].includes(job.status?.toLowerCase() || '');
    return hasActiveStages || isInProgress;
  });

  const completedTodayJobs = userJobs.filter(job => {
    const today = new Date().toDateString();
    return job.stages?.some(stage => 
      accessibleStageIds.includes(stage.production_stage_id) && 
      stage.status === 'completed' &&
      stage.completed_at &&
      new Date(stage.completed_at).toDateString() === today
    );
  });

  if (isLoading || jobsLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading operator dashboard...</span>
      </div>
    );
  }

  if (accessibleStages.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Stage Access</h2>
            <p className="text-gray-600 text-center">
              You don't have access to any production stages. Please contact your administrator to assign you to the appropriate user groups.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operator Dashboard</h1>
          <p className="text-gray-600">Manage your assigned production tasks</p>
          <p className="text-sm text-gray-500 mt-1">
            Total accessible jobs: {userJobs.length} | Available stages: {accessibleStages.length}
          </p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Pending Jobs</p>
                <p className="text-2xl font-bold">{pendingJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{inProgressJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold">{completedTodayJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accessible Jobs List */}
      {userJobs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your Jobs
              <Badge variant="outline">{userJobs.length} jobs</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userJobs.slice(0, 10).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{job.wo_no}</h4>
                      {job.current_stage && (
                        <Badge variant="outline" className="text-xs">
                          {job.current_stage}
                        </Badge>
                      )}
                      {job.status && (
                        <Badge variant="secondary" className="text-xs">
                          {job.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {job.customer && <span>Customer: {job.customer}</span>}
                      {job.reference && <span> • Reference: {job.reference}</span>}
                      {job.due_date && (
                        <span> • Due: {new Date(job.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.workflow_progress > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {job.workflow_progress}% Complete
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {userJobs.length > 10 && (
                <p className="text-sm text-gray-500 text-center">
                  And {userJobs.length - 10} more jobs...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your Jobs
              <Badge variant="outline">0 jobs</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Jobs Found</h3>
              <p className="text-gray-600">
                No jobs are currently available for your accessible stages.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Your Production Stages
            <Badge variant="outline">{accessibleStages.length} stages</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessibleStages.map((stage) => {
              const stageJobs = userJobs.filter(job =>
                job.stages?.some(jobStage => 
                  jobStage.production_stage_id === stage.stage_id
                ) ||
                job.current_stage === stage.stage_name ||
                job.status === stage.stage_name
              );

              return (
                <Card key={stage.stage_id} className="border-2 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.stage_color }}
                      />
                      <h3 className="font-medium">{stage.stage_name}</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {stage.can_view && (
                          <Badge variant="secondary" className="text-xs">View</Badge>
                        )}
                        {stage.can_edit && (
                          <Badge variant="secondary" className="text-xs">Edit</Badge>
                        )}
                        {stage.can_work && (
                          <Badge variant="default" className="text-xs">Work</Badge>
                        )}
                        {stage.can_manage && (
                          <Badge variant="destructive" className="text-xs">Manage</Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {stageJobs.length} job{stageJobs.length !== 1 ? 's' : ''} available
                      </div>
                      
                      <div className="pt-2">
                        <Button 
                          size="sm" 
                          className="w-full"
                          disabled={!canWorkWithStage(stage.stage_id)}
                        >
                          View Jobs ({stageJobs.length})
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-orange-600">Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>User ID:</strong> {user?.id}</p>
                <p><strong>Total jobs in system:</strong> {jobs.length}</p>
                <p><strong>Jobs matching criteria:</strong> {userJobs.length}</p>
                <p><strong>Accessible stages:</strong> {accessibleStages.length}</p>
              </div>
              <div>
                <p><strong>Pending jobs:</strong> {pendingJobs.length}</p>
                <p><strong>In-progress jobs:</strong> {inProgressJobs.length}</p>
                <p><strong>Completed today:</strong> {completedTodayJobs.length}</p>
              </div>
            </div>
            
            <div>
              <p><strong>Accessible stage names:</strong></p>
              <div className="flex flex-wrap gap-1 mt-1">
                {accessibleStages.map(s => (
                  <Badge key={s.stage_id} variant="outline" className="text-xs">
                    {s.stage_name}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <p><strong>Accessible stage IDs:</strong></p>
              <div className="flex flex-wrap gap-1 mt-1">
                {accessibleStages.map(s => (
                  <Badge key={s.stage_id} variant="secondary" className="text-xs">
                    {s.stage_id.substring(0, 8)}...
                  </Badge>
                ))}
              </div>
            </div>
            
            {jobs.length > 0 && (
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p><strong>Sample jobs in system:</strong></p>
                <div className="mt-2 space-y-2">
                  {jobs.slice(0, 3).map(job => (
                    <div key={job.id} className="bg-white p-2 rounded text-xs">
                      <p><strong>WO:</strong> {job.wo_no}</p>
                      <p><strong>Status:</strong> {job.status}</p>
                      <p><strong>Current Stage:</strong> {job.current_stage || 'None'}</p>
                      <p><strong>Has Workflow:</strong> {job.has_workflow ? 'Yes' : 'No'}</p>
                      <p><strong>Stages Count:</strong> {job.stages?.length || 0}</p>
                      {job.stages?.length > 0 && (
                        <p><strong>Stage IDs:</strong> {job.stages.map(s => s.production_stage_id?.substring(0, 8)).join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {jobs.length > 0 && userJobs.length === 0 && (
              <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                <p><strong>Troubleshooting:</strong> No jobs match your stage permissions.</p>
                <p className="mt-1">Check if jobs have the correct status or workflow stages that match your accessible stages: {accessibleStageNames.join(', ')}</p>
                <p className="mt-1">Your accessible stage IDs: {accessibleStageIds.map(id => id.substring(0, 8)).join(', ')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
