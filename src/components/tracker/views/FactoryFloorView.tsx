
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Play, CheckCircle } from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";

interface FactoryFloorViewProps {
  stageFilter?: string | null;
  isDtpOperator?: boolean;
}

export const FactoryFloorView: React.FC<FactoryFloorViewProps> = ({ 
  stageFilter, 
  isDtpOperator = false 
}) => {
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: 'work',
    stageFilter: stageFilter || undefined
  });
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-700">Error Loading Jobs</h2>
            <p className="text-red-600 text-center mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getHeaderTitle = () => {
    if (isDtpOperator) return "DTP & Proofing Jobs";
    return "Factory Floor";
  };

  const getHeaderSubtitle = () => {
    if (isDtpOperator) return "Jobs ready for DTP and proofing work";
    return "Jobs you can work on";
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{getHeaderTitle()}</h1>
          <p className="text-gray-600">{getHeaderSubtitle()}</p>
          <p className="text-sm text-gray-500 mt-1">
            Found {jobs.length} accessible job{jobs.length !== 1 ? 's' : ''}
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

      {/* Job Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Pending Jobs</p>
                <p className="text-2xl font-bold">
                  {jobs.filter(j => j.current_stage_status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Play className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold">
                  {jobs.filter(j => j.current_stage_status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Total Accessible</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs List */}
      {jobs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Work Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.job_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-lg">{job.wo_no}</h4>
                      {job.current_stage_name && (
                        <Badge 
                          variant={job.current_stage_status === 'active' ? 'default' : 'outline'}
                          className={job.current_stage_status === 'active' ? 'bg-green-500' : 'text-orange-600 border-orange-200'}
                        >
                          {job.current_stage_name}
                        </Badge>
                      )}
                      {job.current_stage_status && (
                        <Badge variant="secondary" className="text-xs">
                          {job.current_stage_status === 'active' ? 'Active' : 'Pending'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span>Customer: {job.customer || 'Unknown'}</span>
                      {job.due_date && (
                        <span> • Due: {new Date(job.due_date).toLocaleDateString()}</span>
                      )}
                      <span> • Status: {job.status}</span>
                      {job.workflow_progress > 0 && (
                        <span> • Progress: {job.workflow_progress}%</span>
                      )}
                    </div>
                  </div>
                  
                  <JobActionButtons
                    job={job}
                    onStart={startJob}
                    onComplete={completeJob}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Jobs Available</h3>
            <p className="text-gray-600 text-center">
              {isDtpOperator 
                ? "You don't have any DTP or proofing jobs available right now."
                : "You don't have any jobs that you can work on right now."
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
