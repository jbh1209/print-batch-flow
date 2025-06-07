
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Play, CheckCircle, Clock } from "lucide-react";
import { useSimpleJobAccess } from "@/hooks/tracker/useSimpleJobAccess";

export const UniversalFactoryFloor: React.FC = () => {
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useSimpleJobAccess();

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
            <Button onClick={refreshJobs} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStartJob = async (jobId: string, stageId: string) => {
    await startJob(jobId, stageId);
  };

  const handleCompleteJob = async (jobId: string, stageId: string) => {
    await completeJob(jobId, stageId);
  };

  const workflowJobs = jobs.filter(job => job.has_workflow);
  const legacyJobs = jobs.filter(job => !job.has_workflow);
  const activeJobs = jobs.filter(job => job.stage_status === 'active');
  const pendingJobs = jobs.filter(job => job.stage_status === 'pending');

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Factory Floor</h1>
          <p className="text-gray-600">Jobs you can work on</p>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            <span>Total: {jobs.length}</span>
            <span>New Workflow: {workflowJobs.length}</span>
            <span>Legacy: {legacyJobs.length}</span>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          onClick={refreshJobs}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Job Statistics */}
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
              <Play className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold">{activeJobs.length}</p>
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
        <div className="space-y-4">
          {/* New Workflow Jobs */}
          {workflowJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  New Workflow Jobs
                  <Badge variant="secondary">{workflowJobs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workflowJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-lg">{job.wo_no}</h4>
                          <Badge 
                            variant={job.stage_status === 'active' ? 'default' : 'outline'}
                            className={job.stage_status === 'active' ? 'bg-green-500' : 'text-orange-600 border-orange-200'}
                          >
                            {job.current_stage_name}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {job.stage_status === 'active' ? 'Active' : 'Pending'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>Customer: {job.customer}</span>
                          {job.due_date && (
                            <span> • Due: {new Date(job.due_date).toLocaleDateString()}</span>
                          )}
                          <span> • Status: {job.status}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {job.stage_status === 'pending' && (
                          <Button 
                            size="sm"
                            onClick={() => handleStartJob(job.id, job.current_stage_id)}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Play className="h-4 w-4" />
                            Start
                          </Button>
                        )}
                        {job.stage_status === 'active' && (
                          <Button 
                            size="sm"
                            onClick={() => handleCompleteJob(job.id, job.current_stage_id)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legacy Jobs */}
          {legacyJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Legacy Status Jobs
                  <Badge variant="outline">{legacyJobs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {legacyJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-lg">{job.wo_no}</h4>
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            {job.current_stage_name}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Legacy System
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>Customer: {job.customer}</span>
                          {job.due_date && (
                            <span> • Due: {new Date(job.due_date).toLocaleDateString()}</span>
                          )}
                          <span> • Status: {job.status}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          onClick={() => handleStartJob(job.id, job.current_stage_id)}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Play className="h-4 w-4" />
                          Start
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleCompleteJob(job.id, job.current_stage_id)}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Jobs Available</h3>
            <p className="text-gray-600 text-center">
              You don't have any jobs that you can work on right now.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
