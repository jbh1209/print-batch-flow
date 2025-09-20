
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Play, CheckCircle } from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useSmartPermissionDetection } from "@/hooks/tracker/useSmartPermissionDetection";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { ViewToggle } from "@/components/tracker/common/ViewToggle";
import { JobListView } from "@/components/tracker/common/JobListView";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { getStageDisplayName } from "@/utils/tracker/stageConsolidation";

interface FactoryFloorViewProps {
  stageFilter?: string | null;
  isDtpOperator?: boolean;
}

export const FactoryFloorView: React.FC<FactoryFloorViewProps> = ({ 
  stageFilter, 
  isDtpOperator = false 
}) => {
  const { highestPermission, isLoading: permissionLoading } = useSmartPermissionDetection();
  
  // Simplified job access - let database function do all the work
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: highestPermission,
    stageFilter: stageFilter || undefined
  });
  
  const { consolidatedStages } = useUserStagePermissions();
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Show loading state while detecting permissions
  if (permissionLoading || isLoading) {
    return (
      <div className="flex items-center justify-center p-5 h-full">
        <RefreshCw className="h-7 w-7 animate-spin" />
        <span className="ml-2 text-base">Loading with smart permissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 h-full flex items-center justify-center">
        <Card className="border-red-200 bg-red-50 w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
            <h2 className="text-lg font-semibold mb-1 text-red-700">Error Loading Jobs</h2>
            <p className="text-red-600 text-center mb-2">{error}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getHeaderTitle = () => {
    if (isDtpOperator) return "DTP & Proofing Jobs";
    return `Factory Floor (${highestPermission})`;
  };

  const getHeaderSubtitle = () => {
    if (isDtpOperator) return "Jobs ready for DTP and proofing work";
    return `Jobs you can ${highestPermission} - Simplified permissions`;
  };

  const getEffectiveStageDisplay = (job: any) => {
    if (job.display_stage_name) {
      return job.display_stage_name;
    }
    return getStageDisplayName(job.current_stage_id || '', consolidatedStages);
  };

  const getStageStatus = (job: any) => {
    const status = job.current_stage_status;
    if (status === 'active') return { label: 'Active', variant: 'default', color: 'bg-green-500' };
    if (status === 'pending') return { label: 'Pending', variant: 'outline', color: 'text-orange-600 border-orange-200' };
    return { label: 'Unknown', variant: 'secondary', color: '' };
  };

  console.log('🎯 FactoryFloorView using simplified smart permission:', {
    permission: highestPermission,
    jobCount: jobs.length,
    isDtpOperator
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 bg-white border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{getHeaderTitle()}</h2>
            <p className="text-gray-600 text-sm">{getHeaderSubtitle()}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {jobs.length} accessible job{jobs.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <ViewToggle 
              view={viewMode} 
              onViewChange={setViewMode}
            />
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={refreshing}
              size="sm"
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Simple Job Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="text-xs text-gray-600">Pending</p>
                  <p className="text-base font-bold">
                    {jobs.filter(j => j.current_stage_status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Play className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-600">Active</p>
                  <p className="text-base font-bold">
                    {jobs.filter(j => j.current_stage_status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <p className="text-xs text-gray-600">Total</p>
                  <p className="text-base font-bold">{jobs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Jobs Display - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {jobs.length > 0 ? (
          viewMode === 'card' ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Work Queue (Simplified)</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="space-y-3">
                  {jobs.map((job) => {
                    const effectiveStageDisplay = getEffectiveStageDisplay(job);
                    const stageStatus = getStageStatus(job);

                    return (
                      <div key={job.job_id} className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-base">{job.wo_no}</h4>
                            {effectiveStageDisplay && (
                              <Badge 
                                variant={stageStatus.variant as any}
                                className={stageStatus.color}
                              >
                                {effectiveStageDisplay}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {stageStatus.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            <span>Customer: {job.customer || 'Unknown'}</span>
                            {job.due_date && (
                              <span> • Due: {new Date(job.due_date).toLocaleDateString()}</span>
                            )}
                            <span> • Status: {job.status}</span>
                              {job.workflow_progress > 0 && (
                                <span> • {Math.round(job.workflow_progress)}%</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0 ml-3">
                          <JobActionButtons
                            job={job}
                            onStart={startJob}
                            onComplete={completeJob}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <JobListView
              jobs={jobs}
              onStart={startJob}
              onComplete={completeJob}
            />
          )
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mb-2" />
              <h3 className="text-lg font-semibold mb-1">No Jobs</h3>
              <p className="text-gray-600 text-center text-sm">
                {isDtpOperator 
                  ? "You don't have any DTP or proofing jobs available right now."
                  : "You don't have any jobs that you can work on right now."
                }
              </p>
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                size="sm" 
                className="mt-3"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Jobs
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
