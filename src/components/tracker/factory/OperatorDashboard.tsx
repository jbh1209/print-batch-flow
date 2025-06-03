
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, CheckCircle, AlertTriangle, Bug } from "lucide-react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useUnifiedJobFiltering } from "@/hooks/tracker/useUnifiedJobFiltering";
import { useAuth } from "@/hooks/useAuth";
import { DataFlowDiagnostic } from "../diagnostics/DataFlowDiagnostic";

export const OperatorDashboard = () => {
  const { user } = useAuth();
  // CRITICAL FIX: Fetch ALL jobs in Factory Floor context, not just user's jobs
  const { jobs, isLoading: jobsLoading, refreshJobs } = useEnhancedProductionJobs({ 
    fetchAllJobs: true // This ensures we see all jobs, not just user-created ones
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Use unified filtering to get user's accessible jobs
  const { 
    filteredJobs: userJobs, 
    jobStats, 
    accessibleStages, 
    isLoading: filteringLoading 
  } = useUnifiedJobFiltering({
    jobs
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  console.log("🔍 Operator Dashboard - Unified Filtering Results:", {
    userId: user?.id,
    totalJobs: jobs.length,
    userAccessibleJobs: userJobs.length,
    accessibleStages: accessibleStages.length,
    jobStats
  });

  const isLoading = jobsLoading || filteringLoading;

  if (showDiagnostics) {
    return <DataFlowDiagnostic />;
  }

  if (isLoading) {
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
            <Button 
              onClick={() => setShowDiagnostics(true)}
              variant="outline"
              className="mt-4 flex items-center gap-2"
            >
              <Bug className="h-4 w-4" />
              Run Diagnostics
            </Button>
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
            Accessible jobs: {userJobs.length} | Available stages: {accessibleStages.length}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowDiagnostics(true)}
            className="flex items-center gap-2"
          >
            <Bug className="h-4 w-4" />
            Debug
          </Button>
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
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Pending Jobs</p>
                <p className="text-2xl font-bold">{jobStats.pending}</p>
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
                <p className="text-2xl font-bold">{jobStats.inProgress}</p>
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
                <p className="text-2xl font-bold">{jobStats.completedToday}</p>
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
                      {job.is_active && (
                        <Badge variant="default" className="text-xs bg-blue-500">
                          Active
                        </Badge>
                      )}
                      {job.is_pending && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                          Pending
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
              <p className="text-gray-600 mb-4">
                No jobs are currently available for your accessible stages.
              </p>
              <Button 
                onClick={() => setShowDiagnostics(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Bug className="h-4 w-4" />
                Run Diagnostics
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Production Stages */}
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
              const stageJobCount = jobStats.byStage[stage.stage_name] || 0;

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
                        {stageJobCount} job{stageJobCount !== 1 ? 's' : ''} available
                      </div>
                      
                      <div className="pt-2">
                        <Button 
                          size="sm" 
                          className="w-full"
                          disabled={!stage.can_work}
                        >
                          View Jobs ({stageJobCount})
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
    </div>
  );
};
